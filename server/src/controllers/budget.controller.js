const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Category = require('../models/Category');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const visibleCategoryFilter = (userId) => ({
  $or: [{ userId: null }, { userId }],
  isDeleted: { $ne: true },
});

/**
 * GET /api/budgets - Danh sách ngân sách của user
 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    const filter = { userId };
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      filter.month = month;
    }

    const budgets = await Budget.find(filter)
      .populate('categoryId', 'name icon color type')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: budgets });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * GET /api/budgets/:id - Chi tiết ngân sách
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'ID ngân sách không hợp lệ.' });
    }

    const budget = await Budget.findOne({ _id: id, userId: req.user.id })
      .populate('categoryId', 'name icon color type')
      .lean();

    if (!budget) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ngân sách.' });
    }

    return res.json({ success: true, data: budget });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * POST /api/budgets - Tạo mới ngân sách
 */
exports.create = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      categoryId,
      categoryName,
      limitAmount,
      month,
      period,
      alertThreshold50,
      alertThreshold80,
      alertThreshold100,
    } = req.body;

    const numericAmount = Number(limitAmount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ success: false, message: 'Hạn mức ngân sách phải là số >= 0.' });
    }

    // Xác định tháng (mặc định tháng hiện tại nếu không truyền)
    let targetMonth = month;
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      const d = new Date();
      targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    // Tìm category
    let finalCategoryId = null;
    if (categoryId && isValidId(categoryId)) {
      const cat = await Category.findOne({ _id: categoryId, ...visibleCategoryFilter(userId) });
      if (cat) finalCategoryId = cat._id;
    }

    if (!finalCategoryId) {
      // Tìm category theo categoryName hoặc fallback
      const searchName = categoryName || 'Ăn uống';
      const cat = await Category.findOne({
        ...visibleCategoryFilter(userId),
        $or: [
          { name: new RegExp(searchName, 'i') },
          { type: 'expense' },
        ],
      });
      if (cat) finalCategoryId = cat._id;
    }

    if (!finalCategoryId) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy danh mục phù hợp để tạo ngân sách.' });
    }

    const newBudget = await Budget.create({
      userId,
      categoryId: finalCategoryId,
      limitAmount: numericAmount,
      month: targetMonth,
      period: period || 'monthly',
      alertThreshold50: alertThreshold50 !== undefined ? Boolean(alertThreshold50) : true,
      alertThreshold80: alertThreshold80 !== undefined ? Boolean(alertThreshold80) : true,
      alertThreshold100: alertThreshold100 !== undefined ? Boolean(alertThreshold100) : true,
    });

    const populated = await Budget.findById(newBudget._id).populate('categoryId', 'name icon color type');

    return res.status(201).json({
      success: true,
      message: 'Kích hoạt ngân sách thành công!',
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * PUT /api/budgets/:id - Cập nhật ngân sách
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'ID ngân sách không hợp lệ.' });
    }

    const budget = await Budget.findOne({ _id: id, userId: req.user.id });
    if (!budget) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ngân sách.' });
    }

    const { limitAmount, period, alertThreshold50, alertThreshold80, alertThreshold100 } = req.body;
    if (limitAmount !== undefined) {
      const num = Number(limitAmount);
      if (isNaN(num) || num < 0) {
        return res.status(400).json({ success: false, message: 'Hạn mức ngân sách phải là số >= 0.' });
      }
      budget.limitAmount = num;
    }
    if (period) budget.period = period;
    if (alertThreshold50 !== undefined) budget.alertThreshold50 = Boolean(alertThreshold50);
    if (alertThreshold80 !== undefined) budget.alertThreshold80 = Boolean(alertThreshold80);
    if (alertThreshold100 !== undefined) budget.alertThreshold100 = Boolean(alertThreshold100);

    await budget.save();
    const updated = await Budget.findById(budget._id).populate('categoryId', 'name icon color type');

    return res.json({ success: true, message: 'Cập nhật ngân sách thành công!', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * DELETE /api/budgets/:id - Xóa ngân sách
 */
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'ID ngân sách không hợp lệ.' });
    }

    const budget = await Budget.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!budget) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ngân sách.' });
    }

    return res.json({ success: true, message: 'Xóa ngân sách thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
