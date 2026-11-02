const mongoose = require('mongoose');

/**
 * Thực thi một hàm trong MongoDB Transaction.
 * Tự động tạo session, start transaction, commit hoặc abort khi có lỗi, và kết thúc session.
 * 
 * @param {Function} workFn - Hàm async nhận (session), chứa các thao tác DB cần chạy transaction
 * @returns {Promise<any>} - Kết quả trả về từ workFn
 */
async function runInTransaction(workFn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await workFn(session);
    });
    return result;
  } catch (error) {
    // Nếu DB chưa bật replica set (standalone)
    if (
      error.message &&
      (error.message.includes('Transactions are not supported') ||
        error.message.includes('replica set') ||
        error.code === 20 ||
        error.codeName === 'IllegalOperation')
    ) {
      const err = new Error(
        'Database hiện tại chưa hỗ trợ Transaction (yêu cầu MongoDB Atlas hoặc Replica Set).'
      );
      err.status = 503;
      err.code = 'TRANSACTION_UNSUPPORTED';
      throw err;
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  runInTransaction,
};
