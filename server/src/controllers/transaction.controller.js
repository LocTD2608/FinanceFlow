const mongoose = require('mongoose');
const Category = require('../models/Category');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { getPeriodRange } = require('../utils/period');

const VALID_TYPES = ['expense', 'income'];
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

// POST /api/transactions
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
