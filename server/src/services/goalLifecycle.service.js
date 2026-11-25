const Goal = require('../models/Goal');
const pushService = require('./push.service');
const realtimeService = require('./realtime.service');
const { dayDiff } = require('./financialAlert.service');

const HOURS_24_MS = 24 * 60 * 60 * 1000;

async function notifyGoalLifecycle(userId, payload) {
  const uid = String(userId);
  try {
    await pushService.sendToUser(uid, {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
  } catch (err) {
    console.error('[goalLifecycle] Gửi push notification lỗi:', err.message);
  }

  realtimeService.emitFinancialAlert(uid, {
    type: payload.type,
    level: payload.level,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  });
}

/**
 * Khi user vào app hoặc mở màn hình kiểm tra, nâng ngay các mục tiêu grace_24h đã qua 24h
 * lên trạng thái bắt buộc chọn (decision_required).
 */
async function promoteExpiredGraceGoalsForUser(userId, now = new Date()) {
  await Goal.updateMany(
    {
      userId,
      status: 'active',
      overdueStage: 'grace_24h',
      decisionRequiredAt: { $lte: now },
    },
    { $set: { overdueStage: 'decision_required' } }
  );
}

/**
 * Quét toàn bộ DB lúc 0:00 để phát hiện mục tiêu đến hạn / quá hạn (KAN-69)
 * và điều phối quy trình gia hạn / chờ 24h (KAN-70).
 * @param {Date} now
 */
async function scanDueGoals(now = new Date()) {
  const candidates = await Goal.find({
    status: 'active',
    deadline: { $ne: null },
    $expr: { $lt: ['$currentAmount', '$targetAmount'] },
  }).lean();

  const dueGoalIds = [];
  const overdueGoalIds = [];
  let graceStartedCount = 0;
  let decisionRequiredCount = 0;

  for (const goal of candidates) {
    const diff = dayDiff(goal.deadline, now);
    if (diff === 0) {
      dueGoalIds.push(String(goal._id));
      continue;
    }

    if (diff < 0) {
      overdueGoalIds.push(String(goal._id));
      const stage = goal.overdueStage || 'none';

      if (stage === 'none') {
        const decisionAt = new Date(now.getTime() + HOURS_24_MS);
        const claimed = await Goal.findOneAndUpdate(
          { _id: goal._id, status: 'active', overdueStage: 'none' },
          {
            $set: {
              overdueStage: 'grace_24h',
              overdueNotifiedAt: now,
              decisionRequiredAt: decisionAt,
            },
          },
          { new: true }
        );

        if (claimed) {
          graceStartedCount += 1;
          await notifyGoalLifecycle(goal.userId, {
            type: 'goal_overdue',
            level: 'warning',
            title: 'Mục tiêu tiết kiệm đã quá hạn!',
            body: `Mục tiêu "${goal.name}" đã quá hạn. Bạn có muốn gia hạn thêm thời gian không? Hệ thống sẽ yêu cầu xác nhận sau 24 giờ.`,
            data: {
              type: 'goal_overdue',
              goalId: String(goal._id),
              goalName: goal.name,
              decisionRequiredAt: decisionAt.toISOString(),
            },
          });
        }
      } else if (
        stage === 'grace_24h' &&
        goal.decisionRequiredAt &&
        new Date(goal.decisionRequiredAt) <= now
      ) {
        const claimed = await Goal.findOneAndUpdate(
          {
            _id: goal._id,
            status: 'active',
            overdueStage: 'grace_24h',
            decisionRequiredAt: { $lte: now },
          },
          { $set: { overdueStage: 'decision_required' } },
          { new: true }
        );

        if (claimed) {
          decisionRequiredCount += 1;
          await notifyGoalLifecycle(goal.userId, {
            type: 'goal_expired',
            level: 'danger',
            title: 'Mục tiêu đã hết hạn xử lý',
            body: `Đã quá 24 giờ cho mục tiêu "${goal.name}". Vui lòng vào ứng dụng để chọn Gia hạn tiếp hoặc Dừng gia hạn (hoàn 100% về ví chính).`,
            data: {
              type: 'goal_expired',
              goalId: String(goal._id),
              goalName: goal.name,
              requiresDecision: true,
            },
          });
        }
      }
    }
  }

  return {
    scannedCount: dueGoalIds.length + overdueGoalIds.length,
    dueGoalIds,
    overdueGoalIds,
    graceStartedCount,
    decisionRequiredCount,
  };
}

module.exports = {
  HOURS_24_MS,
  scanDueGoals,
  promoteExpiredGraceGoalsForUser,
};
