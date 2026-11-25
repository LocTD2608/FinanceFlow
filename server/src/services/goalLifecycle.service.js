const Goal = require('../models/Goal');
const { dayDiff } = require('./financialAlert.service');

/**
 * Quét toàn bộ DB lúc 0:00 để phát hiện các mục tiêu đang hoạt động đã đến hạn hoặc quá hạn (KAN-69).
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

  for (const goal of candidates) {
    const diff = dayDiff(goal.deadline, now);
    if (diff === 0) {
      dueGoalIds.push(String(goal._id));
    } else if (diff < 0) {
      overdueGoalIds.push(String(goal._id));
    }
  }

  return {
    scannedCount: dueGoalIds.length + overdueGoalIds.length,
    dueGoalIds,
    overdueGoalIds,
  };
}

module.exports = {
  scanDueGoals,
};
