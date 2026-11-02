const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';

/**
 * Middleware xác thực JWT. Gắn req.user = { id, email, role, status } nếu hợp lệ.
 * Kiểm tra trạng thái khóa tài khoản real-time trong DB.
 */
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Chưa được xác thực.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }

  let userStatus = 'active';
  let userRole = decoded.role || 'user';

  try {
    if (User && typeof User.findById === 'function') {
      const user = await User.findById(decoded.id).select('status role');
      if (user) {
        if (user.status === 'locked') {
          return res.status(403).json({
            success: false,
            message: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ hỗ trợ.',
          });
        }
        userStatus = user.status || 'active';
        userRole = user.role || userRole;
      }
    }
  } catch (dbErr) {
    // Nếu DB không truy vấn được, dùng thông tin từ token
  }

  req.user = {
    id: decoded.id,
    email: decoded.email,
    role: userRole,
    status: userStatus,
  };
  return next();
};
