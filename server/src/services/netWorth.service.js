/**
 * Chụp nhanh tài sản ròng theo tháng.
 *   totalAssets      = Σ max(balance, 0) của các ví đang dùng
 *   totalLiabilities = Σ |balance| của ví credit_card đang âm (dư nợ)
 *   netWorth         = totalAssets - totalLiabilities
 * Bỏ qua ví đã lưu trữ hoặc `isExcludedFromNetWorth`.
 */
const Wallet = require('../models/Wallet');
const NetWorthSnapshot = require('../models/NetWorthSnapshot');

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Lấy các thành phần ngày theo giờ Việt Nam (UTC+7)
const vnParts = (date = new Date()) => {
  const d = new Date(date.getTime() + VN_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

const fmtMonth = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const currentMonth = (date = new Date()) => {
  const p = vnParts(date);
  return fmtMonth(p.year, p.month);
};

const previousMonth = (date = new Date()) => {
  const p = vnParts(date);
  return p.month === 1 ? fmtMonth(p.year - 1, 12) : fmtMonth(p.year, p.month - 1);
};

// Hôm nay (giờ VN) có phải ngày cuối tháng không (ngày mai là mùng 1)
const isLastDayOfMonth = (date = new Date()) => vnParts(new Date(date.getTime() + 24 * 60 * 60 * 1000)).day === 1;

const aggregatePipeline = (match = {}) => [
  { $match: { isArchived: { $ne: true }, isExcludedFromNetWorth: { $ne: true }, ...match } },
  {
    $group: {
      _id: '$userId',
      totalAssets: { $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] } },
      totalLiabilities: {
        $sum: {
          $cond: [{ $and: [{ $eq: ['$type', 'credit_card'] }, { $lt: ['$balance', 0] }] }, { $abs: '$balance' }, 0],
        },
      },
    },
  },
];

/**
 * Chụp tài sản ròng cho tất cả user (hoặc 1 user).
 * @param {string} month YYYY-MM
 * @param {{overwrite?: boolean, userId?: any}} opts overwrite=false: chỉ tạo nếu chưa có (bù tháng bị lỡ)
 * @returns {Promise<number>} số user được xử lý
 */
const snapshotAll = async (month, { overwrite = true, userId } = {}) => {
  const rows = await Wallet.aggregate(aggregatePipeline(userId ? { userId } : {}));
  if (!rows.length) return 0;
  const now = new Date();
  const ops = rows.map((r) => {
    const values = {
      totalAssets: r.totalAssets,
      totalLiabilities: r.totalLiabilities,
      netWorth: r.totalAssets - r.totalLiabilities,
      calculatedAt: now,
    };
    return {
      updateOne: {
        filter: { userId: r._id, month },
        update: overwrite ? { $set: values } : { $setOnInsert: values },
        upsert: true,
      },
    };
  });
  await NetWorthSnapshot.bulkWrite(ops, { ordered: false });
  return rows.length;
};

/**
 * Khi server khởi động: nếu thiếu snapshot của tháng trước thì bù (không ghi đè snapshot có sẵn).
 */
const catchUpPreviousMonth = async (date = new Date()) => snapshotAll(previousMonth(date), { overwrite: false });

/**
 * Xu hướng tài sản ròng N tháng gần nhất (tăng dần theo tháng).
 */
const getTrend = async (userId, months = 6) => {
  const n = Math.min(Math.max(parseInt(months, 10) || 6, 1), 36);
  const list = await NetWorthSnapshot.find({ userId }).sort({ month: -1 }).limit(n).lean();
  return list.reverse();
};

module.exports = {
  vnParts,
  currentMonth,
  previousMonth,
  isLastDayOfMonth,
  snapshotAll,
  catchUpPreviousMonth,
  getTrend,
};
