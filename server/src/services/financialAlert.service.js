const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');
const Transaction = require('../models/Transaction');
const pushService = require('./push.service');
const realtimeService = require('./realtime.service');
const { getPeriodRange } = require('../utils/period');

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Trả về chuỗi YYYY-MM theo giờ Việt Nam (UTC+7)
 */
const toMonthStr = (date = new Date()) => {
  const vnTime = new Date(new Date(date).getTime() + VN_OFFSET_MS);
  const y = vnTime.getUTCFullYear();
  const m = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/**
 * Số ngày lịch (giờ VN) từ now đến targetDate: >0 còn n ngày, 0 hôm nay, <0 quá hạn
 */
const dayDiff = (targetDate, now = new Date()) => {
  const startOfDay = (d) => Math.floor((new Date(d).getTime() + VN_OFFSET_MS) / DAY_MS);
  return startOfDay(targetDate) - startOfDay(now);
};

/**
 * Tính tổng chi tiêu thực tế của danh mục trong tháng theo giờ VN
 */
const getSpentAmount = async (userId, categoryId, monthStr) => {
  const range = getPeriodRange('month', `${monthStr}-01`);
  if (!range) return 0;

  const userObjId = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : userId;
  const categoryObjId = mongoose.Types.ObjectId.isValid(categoryId)
    ? new mongoose.Types.ObjectId(categoryId)
    : categoryId;

  const result = await Transaction.aggregate([
    {
      $match: {
        userId: userObjId,
        categoryId: categoryObjId,
        type: 'expense',
        transactionDate: { $gte: range.from, $lt: range.to },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    },
  ]);

  return result.length > 0 ? result[0].total : 0;
};

/**
 * Đánh giá ngân sách và gửi thông báo nếu chạm ngưỡng chưa cảnh báo
 */
const evaluateBudget = async (budget, spentAmount) => {
  if (!budget || !budget.limitAmount || budget.limitAmount <= 0) {
    return null;
  }

  const percent = Math.floor((spentAmount / budget.limitAmount) * 100);
  const notified = budget.notifiedThresholds || [];

  let threshold = null;
  if (percent >= 100 && budget.alertThreshold100 && !notified.includes(100)) {
    threshold = 100;
  } else if (percent >= 80 && budget.alertThreshold80 && !notified.includes(80)) {
    threshold = 80;
  } else if (percent >= 50 && budget.alertThreshold50 && !notified.includes(50)) {
    threshold = 50;
  }

  if (threshold === null) {
    return null;
  }

  // Khóa nguyên tử chống gửi trùng
  const claimed = await Budget.findOneAndUpdate(
    { _id: budget._id, notifiedThresholds: { $ne: threshold } },
    { $addToSet: { notifiedThresholds: threshold } },
    { new: true }
  );

  if (!claimed) {
    return null;
  }

  const categoryName = budget.categoryId?.name || 'Chi tiêu';
  const spentFormatted = `${Number(spentAmount).toLocaleString('vi-VN')} đ`;
  const limitFormatted = `${Number(budget.limitAmount).toLocaleString('vi-VN')} đ`;

  let level = 'info';
  let title = 'Thông báo: Ngân sách đạt 50%';
  let body = `Bạn đã chi tiêu đạt ${percent}% (${spentFormatted}/${limitFormatted}) ngân sách danh mục ${categoryName}.`;

  if (threshold === 100) {
    level = 'danger';
    title = 'Cảnh báo: Vượt ngân sách!';
    body = `Bạn đã chi tiêu đạt ${percent}% (${spentFormatted}/${limitFormatted}) ngân sách danh mục ${categoryName}. Vui lòng cân đối chi tiêu!`;
  } else if (threshold === 80) {
    level = 'warning';
    title = 'Chú ý: Sắp chạm trần ngân sách!';
    body = `Bạn đã chi tiêu đạt ${percent}% (${spentFormatted}/${limitFormatted}) ngân sách danh mục ${categoryName}. Hãy chú ý các khoản chi tiếp theo.`;
  }

  // 1. Gửi Push Notification
  try {
    await pushService.sendToUser(budget.userId, {
      title,
      body,
      data: {
        type: 'budget_alert',
        budgetId: String(budget._id),
        categoryId: String(budget.categoryId?._id || budget.categoryId),
        threshold,
      },
    });
  } catch (err) {
    console.error('[financialAlert] Gửi push notification lỗi:', err.message);
  }

  // 2. Gửi Realtime Socket.io
  try {
    realtimeService.emitFinancialAlert(budget.userId, {
      type: 'budget_alert',
      level,
      title,
      body,
      threshold,
      data: {
        budgetId: String(budget._id),
        categoryId: String(budget.categoryId?._id || budget.categoryId),
        threshold,
        spentAmount,
        limitAmount: budget.limitAmount,
      },
    });
  } catch (err) {
    console.error('[financialAlert] Phát realtime socket lỗi:', err.message);
  }

  return {
    budgetId: budget._id,
    threshold,
    percent,
    spentAmount,
  };
};

/**
 * Kiểm tra ngân sách tức thì sau khi phát sinh giao dịch chi tiêu (Hook)
 */
const checkExpenseBudget = async (userId, categoryId, transactionDate = new Date()) => {
  try {
    const month = toMonthStr(transactionDate);
    const budget = await Budget.findOne({ userId, categoryId, month }).populate(
      'categoryId',
      'name icon color'
    );

    if (!budget) return null;

    const spent = await getSpentAmount(userId, categoryId, month);
    return await evaluateBudget(budget, spent);
  } catch (err) {
    console.error('[financialAlert] checkExpenseBudget lỗi:', err.message);
    return null;
  }
};

/**
 * Quét toàn bộ ngân sách trong tháng hiện tại và phát cảnh báo nếu chạm ngưỡng
 */
const scanAllBudgets = async (now = new Date()) => {
  try {
    const month = toMonthStr(now);
    const budgets = await Budget.find({ month }).populate('categoryId', 'name icon color');
    let sent = 0;

    for (const budget of budgets) {
      try {
        const spent = await getSpentAmount(budget.userId, budget.categoryId?._id || budget.categoryId, month);
        const result = await evaluateBudget(budget, spent);
        if (result) sent += 1;
      } catch (err) {
        console.error(`[financialAlert] Quét budget ${budget._id} lỗi:`, err.message);
      }
    }

    return sent;
  } catch (err) {
    console.error('[financialAlert] scanAllBudgets lỗi:', err.message);
    return 0;
  }
};

module.exports = {
  toMonthStr,
  dayDiff,
  getSpentAmount,
  evaluateBudget,
  checkExpenseBudget,
  scanAllBudgets,
};
