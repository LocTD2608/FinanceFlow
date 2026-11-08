const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const { getPeriodRange } = require('../utils/period');

const VALID_TYPES = ['expense', 'income'];
// Các type được coi là thu nhập / chi tiêu khi tổng hợp
const INCOME_TYPES = ['income', 'transfer_in', 'p2p_in'];
const EXPENSE_TYPES = ['expense', 'transfer_out', 'p2p_out'];

const round2 = (n) => Math.round(n * 100) / 100;

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Đọc period/date từ query; trả về { range } hoặc { error }
const resolveRange = (query) => {
  const range = getPeriodRange(query.period || 'month', query.date);
  if (!range) {
    return { error: 'period phải là day|week|month|year và date phải có dạng YYYY-MM-DD hợp lệ.' };
  }
  return { range };
};

// Tổng thu/chi trong khoảng [from, to). Gộp transfer_in/p2p_in vào income, transfer_out/p2p_out vào expense.
const sumByType = async (userId, from, to) => {
  const rows = await Transaction.aggregate([
    {
      $match: {
        userId: toObjectId(userId),
        type: { $in: [...INCOME_TYPES, ...EXPENSE_TYPES] },
        transactionDate: { $gte: from, $lt: to },
      },
    },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);
  const result = { income: 0, expense: 0 };
  rows.forEach((r) => {
    if (INCOME_TYPES.includes(r._id)) result.income += r.total;
    if (EXPENSE_TYPES.includes(r._id)) result.expense += r.total;
  });
  return result;
};

// (hiện tại - kỳ trước) / kỳ trước * 100; kỳ trước = 0 -> null
const changePercent = (current, previous) =>
  previous > 0 ? round2(((current - previous) / previous) * 100) : null;

// Tổng số dư các ví chưa archived và không bị loại khỏi tài sản ròng
const totalBalance = async (userId) => {
  const rows = await Wallet.aggregate([
    {
      $match: {
        userId: toObjectId(userId),
        isArchived: false,
        isExcludedFromNetWorth: false,
      },
    },
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);
  return rows.length ? rows[0].total : 0;
};

// GET /api/dashboard/summary?period=day|week|month|year&date=YYYY-MM-DD
exports.summary = async (req, res) => {
  try {
    const { range, error } = resolveRange(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    const userId = req.user.id;
    const [current, previous, balance] = await Promise.all([
      sumByType(userId, range.from, range.to),
      sumByType(userId, range.previous.from, range.previous.to),
      totalBalance(userId),
    ]);

    return res.json({
      success: true,
      data: {
        period: range.period,
        from: range.fromStr,
        to: range.toStr,
        totalIncome: current.income,
        totalExpense: current.expense,
        netChange: current.income - current.expense,
        balance,
        comparison: {
          previousPeriod: { from: range.previous.fromStr, to: range.previous.toStr },
          income: {
            previous: previous.income,
            changePercent: changePercent(current.income, previous.income),
          },
          expense: {
            previous: previous.expense,
            changePercent: changePercent(current.expense, previous.expense),
          },
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
};

// GET /api/dashboard/overview?period=day|month&date=YYYY-MM-DD
exports.overview = async (req, res) => {
  try {
    const { range, error } = resolveRange(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    const userId = req.user.id;
    const [current, previous, balance, topCategoriesRaw, recentTransactions, transactionCount] =
      await Promise.all([
        sumByType(userId, range.from, range.to),
        sumByType(userId, range.previous.from, range.previous.to),
        totalBalance(userId),
        Transaction.aggregate([
          {
            $match: {
              userId: toObjectId(userId),
              type: { $in: EXPENSE_TYPES },
              transactionDate: { $gte: range.from, $lt: range.to },
            },
          },
          { $group: { _id: '$categoryId', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
          {
            $lookup: {
              from: 'categories',
              localField: '_id',
              foreignField: '_id',
              as: 'category',
            },
          },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          { $sort: { amount: -1 } },
          { $limit: 5 },
        ]),
        Transaction.find({
          userId,
          transactionDate: { $gte: range.from, $lt: range.to },
        })
          .sort({ transactionDate: -1, createdAt: -1 })
          .limit(5)
          .populate('categoryId', 'name icon color type')
          .populate('walletId', 'name type currency')
          .lean(),
        Transaction.countDocuments({
          userId,
          transactionDate: { $gte: range.from, $lt: range.to },
        }),
      ]);

    const topCategories = topCategoriesRaw.map((r, index) => ({
      rank: index + 1,
      categoryId: r._id,
      name: r.category ? r.category.name : 'Không xác định',
      icon: r.category ? r.category.icon : 'circle',
      color: r.category ? r.category.color : '#6B7280',
      amount: r.amount,
      percent: current.expense > 0 ? round2((r.amount / current.expense) * 100) : 0,
      transactionCount: r.count,
    }));

    return res.json({
      success: true,
      data: {
        period: range.period,
        from: range.fromStr,
        to: range.toStr,
        totalIncome: current.income,
        totalExpense: current.expense,
        netCashFlow: current.income - current.expense,
        balance,
        comparison: {
          prevIncome: previous.income,
          prevExpense: previous.expense,
          incomeChangePercent: changePercent(current.income, previous.income),
          expenseChangePercent: changePercent(current.expense, previous.expense),
        },
        topCategories,
        recentTransactions,
        transactionCount,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
};

// GET /api/dashboard/breakdown?type=expense|income&period=...&date=...
exports.breakdown = async (req, res) => {
  try {
    const { type } = req.query;
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: 'type phải là expense hoặc income.' });
    }
    const { range, error } = resolveRange(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    // Lọc theo đúng nhóm type (vd: expense → ['expense','transfer_out','p2p_out'])
    const typeFilter = type === 'expense' ? EXPENSE_TYPES : INCOME_TYPES;

    const rows = await Transaction.aggregate([
      {
        $match: {
          userId: toObjectId(req.user.id),
          type: { $in: typeFilter },
          transactionDate: { $gte: range.from, $lt: range.to },
        },
      },
      {
        $group: {
          _id: '$categoryId',
          amount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          // Lấy source để biết đây có phải P2P không
          types: { $addToSet: '$type' },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $sort: { amount: -1 } },
    ]);

    // Tổng bao gồm cả transfer (categoryId = null)
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    const items = rows.map((r, index) => {
      // Giao dịch P2P không có categoryId → hiển thị danh mục ảo "Chuyển tiền"
      const isTransfer = !r._id;
      return {
        rank: index + 1,
        categoryId: r._id,
        name: r.category ? r.category.name : 'Khác',
        icon: r.category ? r.category.icon : 'circle',
        color: r.category ? r.category.color : '#6B7280',
        amount: r.amount,
        percent: total > 0 ? round2((r.amount / total) * 100) : 0,
        transactionCount: r.transactionCount,
        isTransfer,
      };
    });

    return res.json({
      success: true,
      data: {
        type,
        period: range.period,
        from: range.fromStr,
        to: range.toStr,
        total,
        items,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
};
