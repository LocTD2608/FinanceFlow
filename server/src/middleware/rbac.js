/**
 * Middleware phân quyền (Role-Based Access Control)
 * Sử dụng: requireRole('admin') hoặc requireRole('admin', 'moderator')
 */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện chức năng này.',
      });
    }
    return next();
  };
};
