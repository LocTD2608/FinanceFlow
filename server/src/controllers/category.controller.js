const mongoose = require('mongoose');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');

const VALID_TYPES = ['expense', 'income'];
const NAME_COLLATION = { locale: 'vi', strength: 2 }; // không phân biệt hoa/thường, dấu

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Danh mục hiển thị cho user: mặc định hệ thống + của chính user, chưa bị xóa mềm
const visibleFilter = (userId) => ({
  $or: [{ userId: null }, { userId }],
  isDeleted: { $ne: true },
});

const serialize = (c) => ({
  id: c._id,
  name: c.name,
  type: c.type,
  icon: c.icon,
  color: c.color,
  isDefault: c.isDefault,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const isNameTaken = async (userId, name, type, excludeId = null) => {
  const filter = { ...visibleFilter(userId), name, type };
  if (excludeId) filter._id = { $ne: excludeId };
  const found = await Category.findOne(filter).collation(NAME_COLLATION).lean();
  return !!found;
};

// Lấy danh mục của chính user (không phải mặc định). Trả về { error } nếu không hợp lệ.
const getOwnedCategory = async (id, userId) => {
  if (!isValidId(id)) return { status: 400, message: 'ID danh mục không hợp lệ.' };
  const category = await Category.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!category) return { status: 404, message: 'Không tìm thấy danh mục.' };
  if (category.userId === null || category.isDefault) {
    return { status: 403, message: 'Không thể sửa hoặc xóa danh mục mặc định của hệ thống.' };
  }
  if (String(category.userId) !== String(userId)) {
    return { status: 404, message: 'Không tìm thấy danh mục.' };
  }
  return { category };
};

// GET /api/categories?type=expense|income
exports.list = async (req, res) => {
  try {
    const { type } = req.query;
    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Loại danh mục phải là expense hoặc income.' });
    }
    const filter = visibleFilter(req.user.id);
    if (type) filter.type = type;

    const categories = await Category.find(filter)
      .collation(NAME_COLLATION)
      .sort({ isDefault: -1, name: 1 });

    return res.json({ success: true, data: categories.map(serialize) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// GET /api/categories/:id
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'ID danh mục không hợp lệ.' });
    }
    const category = await Category.findOne({ _id: id, ...visibleFilter(req.user.id) });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    }
    return res.json({ success: true, data: serialize(category) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// POST /api/categories
exports.create = async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const { type, icon, color } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Tên danh mục là bắt buộc.' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Loại danh mục phải là expense hoặc income.' });
    }
    if (await isNameTaken(req.user.id, name, type)) {
      return res.status(409).json({ success: false, message: 'Tên danh mục đã tồn tại trong cùng loại.' });
    }

    const category = await Category.create({
      userId: req.user.id,
      name,
      type,
      ...(icon && { icon }),
      ...(color && { color }),
      isDefault: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo danh mục thành công!',
      data: serialize(category),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// PUT /api/categories/:id
exports.update = async (req, res) => {
  try {
    const owned = await getOwnedCategory(req.params.id, req.user.id);
    if (owned.message) {
      return res.status(owned.status).json({ success: false, message: owned.message });
    }
    const { category } = owned;

    const name = req.body.name !== undefined
      ? (typeof req.body.name === 'string' ? req.body.name.trim() : '')
      : category.name;
    const type = req.body.type !== undefined ? req.body.type : category.type;
    const { icon, color } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Tên danh mục là bắt buộc.' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Loại danh mục phải là expense hoặc income.' });
    }
    if (type !== category.type) {
      const used = await Transaction.exists({ userId: req.user.id, categoryId: category._id });
      if (used) {
        return res.status(400).json({
          success: false,
          message: 'Không thể đổi loại danh mục đã có giao dịch.',
        });
      }
    }
    if (await isNameTaken(req.user.id, name, type, category._id)) {
      return res.status(409).json({ success: false, message: 'Tên danh mục đã tồn tại trong cùng loại.' });
    }

    category.name = name;
    category.type = type;
    if (icon) category.icon = icon;
    if (color) category.color = color;
    await category.save();

    return res.json({
      success: true,
      message: 'Cập nhật danh mục thành công!',
      data: serialize(category),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// DELETE /api/categories/:id?reassignTo=<categoryId|other>
exports.remove = async (req, res) => {
  try {
    const userId = req.user.id;
    const owned = await getOwnedCategory(req.params.id, userId);
    if (owned.message) {
      return res.status(owned.status).json({ success: false, message: owned.message });
    }
    const { category } = owned;

    const transactionCount = await Transaction.countDocuments({ userId, categoryId: category._id });

    if (transactionCount > 0) {
      const { reassignTo } = req.query;

      // Chưa chọn danh mục đích -> yêu cầu app hỏi người dùng xác nhận
      if (!reassignTo) {
        return res.status(409).json({
          success: false,
          code: 'CATEGORY_HAS_TRANSACTIONS',
          message: `Danh mục này có ${transactionCount} giao dịch. Vui lòng chọn danh mục để chuyển sang.`,
          transactionCount,
        });
      }

      // Xác định danh mục đích
      let target;
      if (reassignTo === 'other') {
        target = await Category.findOne({
          userId: null,
          isDefault: true,
          isDeleted: { $ne: true },
          type: category.type,
          name: /^Khác/,
        });
        if (!target) {
          return res.status(500).json({ success: false, message: 'Không tìm thấy danh mục "Khác" mặc định.' });
        }
      } else {
        if (!isValidId(reassignTo)) {
          return res.status(400).json({ success: false, message: 'ID danh mục đích không hợp lệ.' });
        }
        if (String(reassignTo) === String(category._id)) {
          return res.status(400).json({ success: false, message: 'Danh mục đích phải khác danh mục đang xóa.' });
        }
        target = await Category.findOne({ _id: reassignTo, ...visibleFilter(userId) });
        if (!target) {
          return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục đích.' });
        }
        if (target.type !== category.type) {
          return res.status(400).json({ success: false, message: 'Danh mục đích phải cùng loại (thu/chi).' });
        }
      }

      await Transaction.updateMany(
        { userId, categoryId: category._id },
        { $set: { categoryId: target._id } }
      );
    }

    // Ngân sách gắn với danh mục bị xóa không còn ý nghĩa -> xóa
    await Budget.deleteMany({ userId, categoryId: category._id });

    category.isDeleted = true;
    category.deletedAt = new Date();
    await category.save();

    return res.json({
      success: true,
      message: 'Xóa danh mục thành công!',
      movedTransactions: transactionCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
