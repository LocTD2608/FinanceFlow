const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

/**
 * 1. Thống kê tổng quan hệ thống (Metrics)
 */
exports.getMetrics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const lockedUsers = await User.countDocuments({ status: 'locked' });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const regularUsers = totalUsers - adminUsers;

    const totalTransactions = await Transaction.countDocuments();
    const totalCategories = await Category.countDocuments({ isDefault: true });

    return res.json({
      success: true,
      metrics: {
        totalUsers,
        activeUsers,
        lockedUsers,
        adminUsers,
        regularUsers,
        totalTransactions,
        totalDefaultCategories: totalCategories,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * 2. Lấy danh sách người dùng (Users List) có tìm kiếm và phân trang
 */
exports.getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const { search, role, status } = req.query;
    const filter = {};

    if (role && ['user', 'admin'].includes(role)) {
      filter.role = role;
    }
    if (status && ['active', 'locked'].includes(status)) {
      filter.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { email: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * 3. Khóa hoặc Mở khóa tài khoản người dùng
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'locked'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ. Chỉ chấp nhận active hoặc locked.' });
    }

    // Bảo vệ an toàn: Admin không thể tự khóa chính mình
    if (id === req.user.id || id === req.user._id?.toString()) {
      return res.status(400).json({ success: false, message: 'Không thể tự khóa tài khoản của chính mình.' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    return res.json({
      success: true,
      message: status === 'locked' ? 'Đã khóa tài khoản người dùng.' : 'Đã mở khóa tài khoản người dùng.',
      user,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * 4. Nâng quyền hoặc Hạ quyền người dùng (Role Management)
 */
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ. Chỉ chấp nhận user hoặc admin.' });
    }

    // Bảo vệ an toàn: Admin không thể tự tước quyền của chính mình
    if ((id === req.user.id || id === req.user._id?.toString()) && role === 'user') {
      return res.status(400).json({ success: false, message: 'Không thể tự tước quyền Quản trị của chính mình.' });
    }

    // Bảo vệ Admin cuối cùng: Không được hạ quyền Admin cuối cùng trong hệ thống
    if (role === 'user') {
      const activeAdminCount = await User.countDocuments({ role: 'admin', status: 'active' });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Hệ thống phải duy trì ít nhất 1 Quản trị viên đang hoạt động.',
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { role } },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    return res.json({
      success: true,
      message: role === 'admin' ? 'Đã nâng cấp tài khoản thành Quản trị viên (Admin).' : 'Đã chuyển tài khoản về Người dùng (User).',
      user,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * 5. Thêm danh mục hệ thống mặc định (Default Category)
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, type, icon, color } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'Tên danh mục và loại (expense/income) là bắt buộc.' });
    }

    const category = await Category.create({
      name: name.trim(),
      type,
      icon: icon || 'tag',
      color: color || '#0284C7',
      isDefault: true,
      userId: null,
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo danh mục hệ thống thành công!',
      category,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * 6. Sửa danh mục hệ thống mặc định
 */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, icon, color } = req.body;

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (type) updateData.type = type;
    if (icon) updateData.icon = icon;
    if (color) updateData.color = color;

    const category = await Category.findOneAndUpdate(
      { _id: id, isDefault: true },
      { $set: updateData },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục hệ thống.' });
    }

    return res.json({
      success: true,
      message: 'Cập nhật danh mục hệ thống thành công!',
      category,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * 7. Xóa danh mục hệ thống mặc định
 */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findOneAndDelete({ _id: id, isDefault: true });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục hệ thống.' });
    }

    return res.json({
      success: true,
      message: 'Đã xóa danh mục hệ thống.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
