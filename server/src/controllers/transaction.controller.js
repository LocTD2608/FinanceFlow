const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const { deltasFor, applyDeltas, insufficientBody } = require('../utils/walletBalance');
const {
  validateNoteForCategory,
  findCategoryForType,
} = require('../utils/categoryRules');

const VALID_TYPES = ['expense', 'income', 'transfer'];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const fail = (res, status, message) => res.status(status).json({ success: false, message });

/**
 * Hoàn tác thô các thay đổi số dư (dùng khi bước sau thất bại). Không áp điều kiện số dư.
 */
const rollbackDeltas = async (deltas) => {
  for (const d of deltas) {
    await Wallet.findByIdAndUpdate(d.walletId, { $inc: { balance: -d.delta } }, { new: true });
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
      return fail(res, 400, 'Số tiền phải là số lớn hơn 0.');
    }

    // 2. Kiểm tra loại giao dịch
    if (!type || !VALID_TYPES.includes(type)) {
      return fail(res, 400, 'Loại giao dịch không hợp lệ (expense, income, transfer).');
    }

    // 3. Kiểm tra ví nguồn
    if (!walletId || !isValidId(walletId)) {
      return fail(res, 400, 'ID ví không hợp lệ.');
    }
    const sourceWallet = await Wallet.findOne({ _id: walletId, userId });
    if (!sourceWallet) {
      return fail(res, 404, 'Không tìm thấy ví nguồn hoặc bạn không có quyền truy cập.');
    }
    if (sourceWallet.isArchived) {
      return fail(res, 400, 'Ví này đã bị lưu trữ, không thể phát sinh giao dịch mới.');
    }

    // 4. Xử lý theo từng loại giao dịch
    let finalCategoryId = null;
    let finalDestWalletId = null;

    if (type === 'transfer') {
      if (!destinationWalletId || !isValidId(destinationWalletId)) {
        return fail(res, 400, 'Giao dịch chuyển khoản yêu cầu chọn ví đích hợp lệ.');
      }
      if (String(destinationWalletId) === String(walletId)) {
        return fail(res, 400, 'Ví đích phải khác ví nguồn chuyển tiền.');
      }
      const destWallet = await Wallet.findOne({ _id: destinationWalletId, userId });
      if (!destWallet) {
        return fail(res, 404, 'Không tìm thấy ví đích hoặc bạn không có quyền truy cập.');
      }
      if (destWallet.isArchived) {
        return fail(res, 400, 'Ví đích đã bị lưu trữ, không thể nhận tiền chuyển.');
      }
      finalDestWalletId = destWallet._id;
      if (categoryId && isValidId(categoryId)) {
        finalCategoryId = categoryId;
      }
    } else {
      // expense hoặc income -> cần categoryId hợp lệ và cùng type
      if (!categoryId || !isValidId(categoryId)) {
        return fail(res, 400, 'Vui lòng chọn danh mục hợp lệ.');
      }
      const found = await findCategoryForType(userId, categoryId, type);
      if (found.message) return fail(res, found.status, found.message);

      // Danh mục "Khác" bắt buộc ghi chú
      const noteError = validateNoteForCategory(found.category, note);
      if (noteError) return fail(res, 400, noteError);

      finalCategoryId = found.category._id;
    }

    // 5. Kiểm tra đủ số dư (ví thường không được âm; ví credit_card được phép âm)
    const spendsFromSource = type === 'expense' || type === 'transfer';
    if (spendsFromSource && sourceWallet.type !== 'credit_card' && sourceWallet.balance < numericAmount) {
      return res.status(400).json(insufficientBody(sourceWallet.balance, numericAmount));
    }

    // 6. Cập nhật số dư ví (có điều kiện, an toàn khi gọi đồng thời)
    const deltas = deltasFor({
      type,
      amount: numericAmount,
      walletId: sourceWallet._id,
      destinationWalletId: finalDestWalletId,
    });
    const applied = await applyDeltas(deltas);
    if (!applied.ok) {
      const fresh = await Wallet.findById(sourceWallet._id);
      const current = fresh ? fresh.balance : sourceWallet.balance;
      return res.status(400).json(insufficientBody(current, numericAmount));
    }

    // 7. Lưu bản ghi Transaction (lỗi thì hoàn tác số dư)
    let transaction;
    try {
      transaction = await Transaction.create({
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
    } catch (err) {
      await rollbackDeltas(deltas);
      throw err;
    }

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
      return fail(res, 400, 'ID giao dịch không hợp lệ.');
    }

    const transaction = await Transaction.findOne({ _id: id, userId: req.user.id })
      .populate('walletId', 'name type currency')
      .populate('destinationWalletId', 'name type currency')
      .populate('categoryId', 'name icon color type')
      .lean();

    if (!transaction) {
      return fail(res, 404, 'Không tìm thấy giao dịch.');
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
      return fail(res, 400, 'ID giao dịch không hợp lệ.');
    }

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      return fail(res, 404, 'Không tìm thấy giao dịch.');
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
      return fail(res, 400, 'Số tiền phải lớn hơn 0.');
    }
    if (!VALID_TYPES.includes(newType)) {
      return fail(res, 400, 'Loại giao dịch không hợp lệ.');
    }

    // Kiểm tra ví mới nếu có thay đổi
    if (walletId && isValidId(walletId)) {
      const w = await Wallet.findOne({ _id: walletId, userId });
      if (!w) return fail(res, 404, 'Không tìm thấy ví đã chọn.');
    }

    // Quy tắc danh mục "Khác" bắt buộc ghi chú (chỉ kiểm tra khi sửa danh mục hoặc ghi chú)
    if (newType !== 'transfer' && (categoryId !== undefined || note !== undefined)) {
      const effectiveCategoryId = categoryId !== undefined ? categoryId : transaction.categoryId;
      if (!effectiveCategoryId || !isValidId(String(effectiveCategoryId))) {
        return fail(res, 400, 'Vui lòng chọn danh mục hợp lệ.');
      }
      const found = await findCategoryForType(userId, effectiveCategoryId, newType);
      if (found.message) return fail(res, found.status, found.message);
      const effectiveNote = note !== undefined ? note : transaction.note;
      const noteError = validateNoteForCategory(found.category, effectiveNote);
      if (noteError) return fail(res, 400, noteError);
    }

    // Hoàn tác số dư cũ + áp số dư mới trong một lần (không để ví thường âm)
    const oldDeltas = deltasFor(
      {
        type: transaction.type,
        amount: transaction.amount,
        walletId: transaction.walletId,
        destinationWalletId: transaction.destinationWalletId,
      },
      true
    );
    const newDeltas = deltasFor({
      type: newType,
      amount: newAmount,
      walletId: newWalletId,
      destinationWalletId: newDestWalletId,
    });
    const allDeltas = [...oldDeltas, ...newDeltas];
    const applied = await applyDeltas(allDeltas);
    if (!applied.ok) {
      return res
        .status(400)
        .json({
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          message: 'Không thể cập nhật vì số dư ví không đủ cho thay đổi này.',
        });
    }

    // Cập nhật các trường
    transaction.amount = newAmount;
    transaction.type = newType;
    transaction.walletId = newWalletId;
    transaction.destinationWalletId = newDestWalletId;
    if (categoryId !== undefined) transaction.categoryId = categoryId;
    if (transactionDate) transaction.transactionDate = new Date(transactionDate);
    if (note !== undefined) transaction.note = typeof note === 'string' ? note.trim() : '';
    if (receiptImageUrl !== undefined) transaction.receiptImageUrl = receiptImageUrl;

    try {
      await transaction.save();
    } catch (err) {
      await rollbackDeltas(allDeltas);
      throw err;
    }

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
      return fail(res, 400, 'ID giao dịch không hợp lệ.');
    }

    const transaction = await Transaction.findOne({ _id: id, userId });
    if (!transaction) {
      return fail(res, 404, 'Không tìm thấy giao dịch.');
    }

    // Hoàn tác lại số dư (không để ví thường âm)
    const deltas = deltasFor(
      {
        type: transaction.type,
        amount: transaction.amount,
        walletId: transaction.walletId,
        destinationWalletId: transaction.destinationWalletId,
      },
      true
    );
    const applied = await applyDeltas(deltas);
    if (!applied.ok) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: 'Không thể xóa vì số dư ví hiện tại không đủ để hoàn tác giao dịch này.',
      });
    }

    try {
      await transaction.deleteOne();
    } catch (err) {
      await rollbackDeltas(deltas);
      throw err;
    }

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
