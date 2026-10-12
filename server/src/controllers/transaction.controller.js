const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Category = require('../models/Category');

const VALID_TYPES = ['expense', 'income', 'transfer'];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const visibleCategoryFilter = (userId) => ({
  $or: [{ userId: null }, { userId }],
  isDeleted: { $ne: true },
});

/**
 * Tính toán & áp dụng thay đổi số dư lên ví.
 * @param {Object} txInfo { type, amount, walletId, destinationWalletId }
 * @param {boolean} revert true khi cần hoàn tác lại giao dịch (khi sửa/xóa)
 */
const adjustWalletBalances = async ({ type, amount, walletId, destinationWalletId }, revert = false) => {
  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) return;

  if (type === 'expense') {
    // Chi tiêu: bình thường là -amount, khi revert là +amount
    const delta = revert ? numericAmount : -numericAmount;
    await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: delta } }, { new: true });
  } else if (type === 'income') {
    // Thu nhập: bình thường là +amount, khi revert là -amount
    const delta = revert ? -numericAmount : numericAmount;
    await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: delta } }, { new: true });
  } else if (type === 'transfer') {
    // Chuyển khoản:
    // Ví nguồn: bình thường -amount, revert +amount
    // Ví đích: bình thường +amount, revert -amount
    const sourceDelta = revert ? numericAmount : -numericAmount;
    const destDelta = revert ? -numericAmount : numericAmount;

    await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: sourceDelta } }, { new: true });
    if (destinationWalletId) {
      await Wallet.findByIdAndUpdate(destinationWalletId, { $inc: { balance: destDelta } }, { new: true });
    }
  }
};

// ──────────────────────────────────────────────
// POST /api/transactions - Tạo giao dịch mới
// ──────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, type, walletId, categoryId, destinationWalletId, transactionDate, note, receiptImageUrl } = req.body;

    // 1. Kiểm tra số tiền
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền phải là số lớn hơn 0.' });
    }

    // 2. Kiểm tra loại giao dịch
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'Loại giao dịch không hợp lệ (expense, income, transfer).' });
    }

    // 3. Kiểm tra ví nguồn
    if (!walletId || !isValidId(walletId)) {
      return res.status(400).json({ success: false, message: 'ID ví không hợp lệ.' });
    }
    const sourceWallet = await Wallet.findOne({ _id: walletId, userId });
    if (!sourceWallet) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ví nguồn hoặc bạn không có quyền truy cập.' });
    }
    if (sourceWallet.isArchived) {
      return res.status(400).json({ success: false, message: 'Ví này đã bị lưu trữ, không thể phát sinh giao dịch mới.' });
    }

    // 4. Xử lý theo từng loại giao dịch
    let finalCategoryId = null;
    let finalDestWalletId = null;

    if (type === 'transfer') {
      if (!destinationWalletId || !isValidId(destinationWalletId)) {
        return res.status(400).json({ success: false, message: 'Giao dịch chuyển khoản yêu cầu chọn ví đích hợp lệ.' });
      }
      if (String(destinationWalletId) === String(walletId)) {
        return res.status(400).json({ success: false, message: 'Ví đích phải khác ví nguồn chuyển tiền.' });
      }
      const destWallet = await Wallet.findOne({ _id: destinationWalletId, userId });
      if (!destWallet) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy ví đích hoặc bạn không có quyền truy cập.' });
      }
      if (destWallet.isArchived) {
        return res.status(400).json({ success: false, message: 'Ví đích đã bị lưu trữ, không thể nhận tiền chuyển.' });
      }
      finalDestWalletId = destWallet._id;
      if (categoryId && isValidId(categoryId)) {
        finalCategoryId = categoryId;
      }
    } else {
      // expense hoặc income -> cần categoryId hợp lệ và cùng type
      if (!categoryId || !isValidId(categoryId)) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn danh mục hợp lệ.' });
      }
      const category = await Category.findOne({ _id: categoryId, ...visibleCategoryFilter(userId) });
      if (!category) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
      }
      if (category.type !== type) {
        return res.status(400).json({
          success: false,
          message: `Danh mục "${category.name}" là loại ${category.type}, không khớp với loại giao dịch ${type}.`,
        });
      }
      finalCategoryId = category._id;
    }

    // 5. Cập nhật số dư ví
    await adjustWalletBalances({
      type,
      amount: numericAmount,
      walletId: sourceWallet._id,
      destinationWalletId: finalDestWalletId,
    });

    // 6. Lưu bản ghi Transaction
    const transaction = await Transaction.create({
      userId,
      walletId: sourceWallet._id,
      categoryId: finalCategoryId,
      destinationWalletId: finalDestWalletId,
      amount: numericAmount,
      type,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      note: typeof note === 'string' ? note.trim() : '',
      receiptImageUrl: receiptImageUrl || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Ghi nhận giao dịch thành công!',
      data: transaction,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ──────────────────────────────────────────────
// GET /api/transactions - Danh sách giao dịch
// ──────────────────────────────────────────────
exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    const { walletId, categoryId, type, month, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filter = { userId };

    if (type && VALID_TYPES.includes(type)) {
      filter.type = type;
    }
    if (walletId && isValidId(walletId)) {
      filter.$or = [{ walletId }, { destinationWalletId: walletId }];
    }
    if (categoryId && isValidId(categoryId)) {
      filter.categoryId = categoryId;
    }

    // Lọc theo tháng YYYY-MM
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split('-').map(Number);
      const start = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));
      filter.transactionDate = { $gte: start, $lte: end };
    } else if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .sort({ transactionDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('walletId', 'name type currency')
      .populate('destinationWalletId', 'name type currency')
      .populate('categoryId', 'name icon color type')
      .lean();

    return res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ──────────────────────────────────────────────
// GET /api/transactions/:id - Chi tiết giao dịch
// ──────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ.' });
    }

    const transaction = await Transaction.findOne({ _id: id, userId: req.user.id })
      .populate('walletId', 'name type currency')
      .populate('destinationWalletId', 'name type currency')
      .populate('categoryId', 'name icon color type')
      .lean();

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
    }

    return res.json({ success: true, data: transaction });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ──────────────────────────────────────────────
// PUT /api/transactions/:id - Cập nhật giao dịch
// ──────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ.' });
    }

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
    }

    const {
      amount,
      type,
      walletId,
      categoryId,
      destinationWalletId,
      transactionDate,
      note,
      receiptImageUrl,
    } = req.body;

    const newAmount = amount !== undefined ? Number(amount) : transaction.amount;
    const newType = type !== undefined ? type : transaction.type;
    const newWalletId = walletId !== undefined ? walletId : transaction.walletId;
    const newDestWalletId = destinationWalletId !== undefined ? destinationWalletId : transaction.destinationWalletId;

    if (isNaN(newAmount) || newAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền phải lớn hơn 0.' });
    }
    if (!VALID_TYPES.includes(newType)) {
      return res.status(400).json({ success: false, message: 'Loại giao dịch không hợp lệ.' });
    }

    // Kiểm tra ví mới nếu có thay đổi
    if (walletId && isValidId(walletId)) {
      const w = await Wallet.findOne({ _id: walletId, userId });
      if (!w) return res.status(404).json({ success: false, message: 'Không tìm thấy ví đã chọn.' });
    }

    // 1. Hoàn tác tác động số dư cũ
    await adjustWalletBalances(
      {
        type: transaction.type,
        amount: transaction.amount,
        walletId: transaction.walletId,
        destinationWalletId: transaction.destinationWalletId,
      },
      true // revert = true
    );

    // 2. Áp dụng tác động số dư mới
    await adjustWalletBalances(
      {
        type: newType,
        amount: newAmount,
        walletId: newWalletId,
        destinationWalletId: newDestWalletId,
      },
      false // apply = true
    );

    // 3. Cập nhật các trường
    transaction.amount = newAmount;
    transaction.type = newType;
    transaction.walletId = newWalletId;
    transaction.destinationWalletId = newDestWalletId;
    if (categoryId !== undefined) transaction.categoryId = categoryId;
    if (transactionDate) transaction.transactionDate = new Date(transactionDate);
    if (note !== undefined) transaction.note = typeof note === 'string' ? note.trim() : '';
    if (receiptImageUrl !== undefined) transaction.receiptImageUrl = receiptImageUrl;

    await transaction.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật giao dịch thành công!',
      data: transaction,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ──────────────────────────────────────────────
// DELETE /api/transactions/:id - Xóa giao dịch
// ──────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ.' });
    }

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch.' });
    }

    // Hoàn tác lại số dư
    await adjustWalletBalances(
      {
        type: transaction.type,
        amount: transaction.amount,
        walletId: transaction.walletId,
        destinationWalletId: transaction.destinationWalletId,
      },
      true // revert = true
    );

    await transaction.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Xóa giao dịch thành công và đã hoàn tất khôi phục số dư ví!',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ──────────────────────────────────────────────
// GET /api/transactions/summary - Tổng thu, chi, dòng tiền ròng
// ──────────────────────────────────────────────
exports.summary = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { month } = req.query;

    const match = { userId };
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split('-').map(Number);
      const start = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));
      match.transactionDate = { $gte: start, $lte: end };
    }

    const stats = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalIncome = 0;
    let totalExpense = 0;

    stats.forEach((item) => {
      if (item._id === 'income') totalIncome = item.totalAmount;
      if (item._id === 'expense') totalExpense = item.totalAmount;
    });

    return res.json({
      success: true,
      data: {
        totalIncome,
        totalExpense,
        netCashFlow: totalIncome - totalExpense,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
