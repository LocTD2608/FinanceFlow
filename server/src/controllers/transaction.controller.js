const mongoose = require('mongoose');
const Category = require('../models/Category');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { getPeriodRange } = require('../utils/period');

const VALID_TYPES = ['expense', 'income'];
const ALL_TYPES = ['expense', 'income', 'transfer'];
const OTHER_NOTE_MAX = 50;
const OFFSET_MS = 7 * 60 * 60 * 1000; // giờ Hà Nội (UTC+7)
const BUDGET_THRESHOLDS = [
  { percent: 100, flag: 'alertThreshold100' },
  { percent: 80, flag: 'alertThreshold80' },
  { percent: 50, flag: 'alertThreshold50' },
];

const isValidId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));
const round2 = (n) => Math.round(n * 100) / 100;

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const serialize = (t) => ({
  id: t._id,
  type: t.type,
  amount: t.amount,
  categoryId: t.categoryId,
  walletId: t.walletId,
  note: t.note,
  transactionDate: t.transactionDate,
  createdAt: t.createdAt,
});

// Danh mục "Khác" mặc định của hệ thống
const isOtherCategory = (category) =>
  category.isDefault === true && category.userId === null && /^Khác/.test(category.name);

// Ví mặc định: ví chưa archived, không bị loại khỏi tài sản ròng, tạo sớm nhất.
// User chưa có ví -> tự tạo "Ví mặc định" (số dư 0).
const getDefaultWallet = async (userId) => {
  const wallet = await Wallet.findOne({
    userId,
    isArchived: false,
    isExcludedFromNetWorth: false,
  })
    .sort({ createdAt: 1 })
    .lean();
  if (wallet) return wallet;
  return Wallet.create({ userId, name: 'Ví mặc định', type: 'cash', balance: 0 });
};

// Cảnh báo ngân sách khi giao dịch chi này vừa vượt qua một ngưỡng 50/80/100%.
// Lỗi ở bước này không làm hỏng giao dịch đã ghi nhận.
const getBudgetAlert = async (userId, category, transactionDate, amount) => {
  try {
    const localDate = new Date(transactionDate.getTime() + OFFSET_MS).toISOString().slice(0, 10);
    const range = getPeriodRange('month', localDate);
    const budget = await Budget.findOne({
      userId,
      categoryId: category._id,
      month: localDate.slice(0, 7),
    }).lean();
    if (!budget || !(budget.limitAmount > 0)) return null;

    const rows = await Transaction.aggregate([
      {
        $match: {
          userId: toObjectId(userId),
          categoryId: toObjectId(category._id),
          type: 'expense',
          transactionDate: { $gte: range.from, $lt: range.to },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const spent = rows.length ? rows[0].total : 0;
    const percent = (spent / budget.limitAmount) * 100;
    const previousPercent = ((spent - amount) / budget.limitAmount) * 100;

    const crossed = BUDGET_THRESHOLDS.find(
      (t) => budget[t.flag] !== false && percent >= t.percent && previousPercent < t.percent
    );
    if (!crossed) return null;

    return {
      categoryName: category.name,
      limitAmount: budget.limitAmount,
      spent,
      percent: round2(percent),
      threshold: crossed.percent,
    };
  } catch (err) {
    return null;
  }
};

/**
 * Tính toán & áp dụng thay đổi số dư lên ví (khi sửa/xóa giao dịch).
 * @param {Object} txInfo { type, amount, walletId, destinationWalletId }
 * @param {boolean} revert true khi cần hoàn tác lại giao dịch
 */
const adjustWalletBalances = async ({ type, amount, walletId, destinationWalletId }, revert = false) => {
  const numericAmount = Number(amount);
  if (!numericAmount || numericAmount <= 0) return;

  if (type === 'expense') {
    const delta = revert ? numericAmount : -numericAmount;
    await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: delta } }, { new: true });
  } else if (type === 'income') {
    const delta = revert ? -numericAmount : numericAmount;
    await Wallet.findByIdAndUpdate(walletId, { $inc: { balance: delta } }, { new: true });
  } else if (type === 'transfer') {
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
    const { type, categoryId, walletId } = req.body;
    const amount = req.body.amount;
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

    if (!VALID_TYPES.includes(type)) {
      return fail(res, 400, 'Loại giao dịch phải là expense hoặc income.');
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return fail(res, 400, 'Số tiền phải là số lớn hơn 0.');
    }
    if (!isValidId(categoryId)) {
      return fail(res, 400, 'ID danh mục không hợp lệ.');
    }
    if (walletId !== undefined && !isValidId(walletId)) {
      return fail(res, 400, 'ID ví không hợp lệ.');
    }

    // Danh mục: mặc định hệ thống hoặc của chính user, chưa xóa
    const category = await Category.findOne({
      _id: categoryId,
      $or: [{ userId: null }, { userId }],
      isDeleted: { $ne: true },
    }).lean();
    if (!category) return fail(res, 404, 'Không tìm thấy danh mục.');
    if (category.type !== type) {
      return fail(res, 400, 'Loại danh mục không khớp với loại giao dịch.');
    }
    if (isOtherCategory(category)) {
      if (!note) return fail(res, 400, 'Vui lòng nhập ghi chú khi chọn danh mục "Khác".');
      if (note.length > OTHER_NOTE_MAX) {
        return fail(res, 400, `Ghi chú tối đa ${OTHER_NOTE_MAX} ký tự.`);
      }
    }

    let transactionDate = new Date();
    if (req.body.transactionDate !== undefined) {
      transactionDate = new Date(req.body.transactionDate);
      if (Number.isNaN(transactionDate.getTime())) {
        return fail(res, 400, 'Ngày giao dịch không hợp lệ.');
      }
    }

    // Ví
    let wallet;
    if (walletId) {
      wallet = await Wallet.findOne({ _id: walletId, userId, isArchived: false }).lean();
      if (!wallet) return fail(res, 404, 'Không tìm thấy ví.');
    } else {
      wallet = await getDefaultWallet(userId);
    }

    // Cập nhật số dư nguyên tử (chi: chỉ khi đủ tiền)
    const delta = type === 'expense' ? -amount : amount;
    const walletFilter = { _id: wallet._id, userId, isArchived: false };
    if (type === 'expense') walletFilter.balance = { $gte: amount };

    const updatedWallet = await Wallet.findOneAndUpdate(
      walletFilter,
      { $inc: { balance: delta } },
      { new: true }
    );
    if (!updatedWallet) {
      const current = await Wallet.findOne({ _id: wallet._id, userId, isArchived: false }).lean();
      if (!current) return fail(res, 404, 'Không tìm thấy ví.');
      return fail(res, 400, 'Số dư không đủ để thực hiện giao dịch.', {
        code: 'INSUFFICIENT_BALANCE',
        currentBalance: current.balance,
        shortfall: amount - current.balance,
      });
    }

    // Tạo giao dịch; lỗi thì hoàn tác số dư
    let transaction;
    try {
      transaction = await Transaction.create({
        userId,
        walletId: wallet._id,
        categoryId: category._id,
        amount,
        type,
        transactionDate,
        note,
      });
    } catch (err) {
      await Wallet.updateOne({ _id: wallet._id }, { $inc: { balance: -delta } });
      throw err;
    }

    const body = {
      success: true,
      message: 'Tạo giao dịch thành công!',
      data: serialize(transaction),
      wallet: { id: updatedWallet._id, balance: updatedWallet.balance },
    };
    if (type === 'expense') {
      const budgetAlert = await getBudgetAlert(userId, category, transactionDate, amount);
      if (budgetAlert) body.budgetAlert = budgetAlert;
    }
    return res.status(201).json(body);
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

    if (type && ALL_TYPES.includes(type)) {
      filter.type = type;
    }
    if (walletId && mongoose.Types.ObjectId.isValid(walletId)) {
      filter.$or = [{ walletId }, { destinationWalletId: walletId }];
    }
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
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
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
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
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
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
    if (!ALL_TYPES.includes(newType)) {
      return res.status(400).json({ success: false, message: 'Loại giao dịch không hợp lệ.' });
    }

    // Kiểm tra ví mới nếu có thay đổi
    if (walletId && mongoose.Types.ObjectId.isValid(walletId)) {
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
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
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
