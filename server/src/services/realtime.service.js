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

/**
 * Phát sự kiện cảnh báo tài chính tới user qua Socket.io (KAN-33)
 * @param {string} userId - ID người dùng nhận thông báo
 * @param {object} alert - Dữ liệu cảnh báo tài chính
 *   id?: string
 *   type: 'budget_alert' | 'savings_reminder'
 *   level?: 'info' | 'warning' | 'danger' | 'success'
 *   title: string
 *   body: string
 *   data?: object
 *   timestamp?: string
 */
exports.emitFinancialAlert = (userId, alert = {}) => {
  try {
    const io = socket.getIO();
    if (!io) return;

    const payload = {
      id: alert.id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: alert.type || 'budget_alert',
      level: alert.level || 'warning',
      title: alert.title || 'Cảnh báo tài chính',
      body: alert.body || '',
      data: alert.data || {},
      timestamp: alert.timestamp || new Date().toISOString(),
    };

    io.to(`user_${userId}`).emit('financial:alert', payload);
  } catch (err) {
    console.error('Lỗi khi phát sự kiện financial:alert:', err.message);
  }
};
