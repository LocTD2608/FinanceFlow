const Transaction = require('../models/Transaction');

const OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

const pad = (n) => String(n).padStart(2, '0');
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * GET /api/reports/daily?month=YYYY-MM&type=expense|income|all
 * Báo cáo chi tiêu/thu nhập theo ngày trong tháng
 * Trả về:
 * - series: đầy đủ các ngày trong tháng (zero-filling) phục vụ biểu đồ
 * - days: danh sách gom theo ngày chứa chi tiết toàn bộ các giao dịch
 * - total, average, max
 */
exports.getDailyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    let { month, type = 'expense' } = req.query;

    const validTypes = ['expense', 'income', 'all'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type phải là expense, income hoặc all.',
      });
    }

    // Mặc định tháng hiện tại theo giờ Việt Nam
    const nowVn = new Date(Date.now() + OFFSET_MS);
    if (!month || !/^\d{4}-\d{2}$/.test(String(month).trim())) {
      month = `${nowVn.getUTCFullYear()}-${pad(nowVn.getUTCMonth() + 1)}`;
    } else {
      month = String(month).trim();
    }

    const [year, monthNum] = month.split('-').map(Number);
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ success: false, message: 'Tháng không hợp lệ.' });
    }

    // Tính mốc thời gian bắt đầu và kết thúc tháng (giờ UTC+7)
    const startUtc = new Date(Date.UTC(year, monthNum - 1, 1) - OFFSET_MS);
    const endUtc = new Date(Date.UTC(year, monthNum, 1) - OFFSET_MS);
    const totalDays = new Date(year, monthNum, 0).getDate();

    // Lọc giao dịch
    const typeFilter = type === 'all' ? { $in: ['expense', 'income'] } : type;
    const transactions = await Transaction.find({
      userId,
      type: typeFilter,
      transactionDate: { $gte: startUtc, $lt: endUtc },
    })
      .sort({ transactionDate: -1, createdAt: -1 })
      .populate('categoryId', 'name icon color type')
      .populate('walletId', 'name type currency')
      .lean();

    // Khởi tạo map cho tất cả các ngày trong tháng (1 .. totalDays)
    const dailyMap = {};
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${pad(monthNum)}-${pad(d)}`;
      dailyMap[d] = {
        date: dateStr,
        day: d,
        amount: 0,
        records: [],
      };
    }

    // Gom giao dịch vào từng ngày
    let total = 0;
    transactions.forEach((tx) => {
      const txVn = new Date(new Date(tx.transactionDate).getTime() + OFFSET_MS);
      const day = txVn.getUTCDate();
      if (dailyMap[day]) {
        dailyMap[day].amount += tx.amount;
        dailyMap[day].records.push(tx);
        total += tx.amount;
      }
    });

    // Tạo mảng series liên tục (zero-filled)
    const series = [];
    let maxItem = { date: dailyMap[1].date, amount: 0 };

    for (let d = 1; d <= totalDays; d++) {
      const item = dailyMap[d];
      series.push({
        date: item.date,
        day: item.day,
        amount: item.amount,
      });
      if (item.amount > maxItem.amount) {
        maxItem = { date: item.date, amount: item.amount };
      }
    }

    // Mảng days chứa những ngày có giao dịch (ngày mới nhất lên trước)
    const days = Object.values(dailyMap)
      .filter((item) => item.records.length > 0)
      .sort((a, b) => b.day - a.day)
      .map((item) => ({
        date: item.date,
        totalAmount: item.amount,
        records: item.records,
      }));

    // Tính mức trung bình ngày
    // Nếu là tháng hiện tại: chỉ chia cho số ngày đã qua đến hôm nay
    const isCurrentMonth =
      nowVn.getUTCFullYear() === year && nowVn.getUTCMonth() + 1 === monthNum;
    let divisor = totalDays;
    if (isCurrentMonth) {
      divisor = Math.min(nowVn.getUTCDate(), totalDays);
    }
    const average = divisor > 0 ? round2(total / divisor) : 0;

    return res.json({
      success: true,
      data: {
        month,
        type,
        total,
        average,
        max: maxItem,
        series,
        days,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
