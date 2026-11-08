const cron = require('node-cron');
const financialAlert = require('../services/financialAlert.service');

const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Quét định kỳ ngân sách và mục tiêu tiết kiệm.
 * @param {Date} now
 * @returns {Promise<{ budgetCount: number, savingsCount: number, total: number }>}
 */
const run = async (now = new Date()) => {
  let budgetCount = 0;
  let savingsCount = 0;

  try {
    budgetCount = await financialAlert.scanAllBudgets(now);
  } catch (err) {
    console.error('[financialAlert.job] Lỗi khi quét ngân sách:', err.message);
  }

  try {
    savingsCount = await financialAlert.scanSavingsReminders(now);
  } catch (err) {
    console.error('[financialAlert.job] Lỗi khi quét mục tiêu tiết kiệm:', err.message);
  }

  return {
    budgetCount,
    savingsCount,
    total: budgetCount + savingsCount,
  };
};

/**
 * Đăng ký cronjob chạy 08:30 sáng hàng ngày (giờ Hà Nội)
 */
const start = () => {
  cron.schedule(
    '30 8 * * *',
    () => {
      run().catch((err) => console.error('[financialAlert.job] Lỗi thực thi cron:', err.message));
    },
    { timezone: TZ }
  );
};

module.exports = { start, run };
