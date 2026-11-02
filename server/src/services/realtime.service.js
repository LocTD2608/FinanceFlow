const socket = require('../socket');

/**
 * Phát sự kiện biến động số dư tới user qua Socket.io
 * @param {string} userId - ID người dùng nhận thông báo
 * @param {object} data - Dữ liệu biến động số dư
 *   type: 'income' | 'expense' | 'transfer'
 *   direction: 'in' | 'out'
 *   amount: number
 *   walletId: string
 *   walletName: string
 *   newBalance: number
 *   note: string
 */
exports.emitBalanceChange = (userId, data) => {
  try {
    const io = socket.getIO();
    if (!io) return;

    const payload = {
      ...data,
      timestamp: data.timestamp || new Date().toISOString(),
    };

    io.to(`user_${userId}`).emit('balance:change', payload);
  } catch (err) {
    console.error('Lỗi khi phát sự kiện balance:change:', err.message);
  }
};
