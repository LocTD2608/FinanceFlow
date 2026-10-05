const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';

/**
 * Middleware xác thực JWT. Gắn req.user = { id, email } nếu hợp lệ.
 */
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Chưa được xác thực.' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};
