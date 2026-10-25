const cron = require('node-cron');
const netWorth = require('../services/netWorth.service');

const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Chụp tài sản ròng vào ngày cuối tháng lúc 23:30 (giờ VN).
 * Cron chạy mỗi ngày 28-31 rồi tự kiểm tra có phải ngày cuối tháng không (tháng 28/29/30/31 ngày).
 */
const runMonthEnd = async (now = new Date()) => {
  if (!netWorth.isLastDayOfMonth(now)) return 0;
  return netWorth.snapshotAll(netWorth.currentMonth(now), { overwrite: true });
};

const start = () => {
  cron.schedule(
    '30 23 28-31 * *',
    () => runMonthEnd().catch((e) => console.error('[netWorth.job] lỗi:', e.message)),
    { timezone: TZ }
  );
  // Bù snapshot tháng trước nếu server tắt đúng ngày cuối tháng
  netWorth.catchUpPreviousMonth().catch((e) => console.error('[netWorth.job] bù snapshot lỗi:', e.message));
};

module.exports = { start, runMonthEnd };
