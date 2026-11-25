const cron = require('node-cron');
const goalLifecycleService = require('../services/goalLifecycle.service');

/**
 * Chạy một lượt quét mục tiêu đến hạn/quá hạn lúc 0:00 (KAN-69).
 * @param {Date} now
 */
async function run(now = new Date()) {
  try {
    const result = await goalLifecycleService.scanDueGoals(now);
    console.log(
      `[goalLifecycle.job] Đã quét mục tiêu lúc 0:00: ${result.scannedCount} mục tiêu đến/quá hạn.`
    );
    return result;
  } catch (err) {
    console.error('[goalLifecycle.job] Lỗi khi quét mục tiêu đến hạn:', err.message);
    return {
      scannedCount: 0,
      dueGoalIds: [],
      overdueGoalIds: [],
      error: err.message,
    };
  }
}

/**
 * Đăng ký cronjob chạy hằng ngày vào 0:00 giờ Việt Nam (Asia/Ho_Chi_Minh).
 */
function start() {
  return cron.schedule(
    '0 0 * * *',
    () => {
      run();
    },
    { timezone: 'Asia/Ho_Chi_Minh' }
  );
}

module.exports = {
  run,
  start,
};
