const cron = require('node-cron');
const BillReminder = require('../models/BillReminder');
const push = require('../services/push.service');

const TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Số ngày lịch (giờ VN) từ hôm nay đến ngày đến hạn: >0 còn n ngày, 0 hôm nay, <0 quá hạn
const dayDiff = (dueDate, now = new Date()) => {
  const startOfDay = (d) => Math.floor((d.getTime() + VN_OFFSET_MS) / DAY_MS);
  return startOfDay(new Date(dueDate)) - startOfDay(now);
};

// Mốc nhắc ứng với số ngày còn lại
const stageFor = (diff) => {
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'd0';
  if (diff === 1) return 'd-1';
  if (diff <= 3) return 'd-3';
  return null;
};

const messageFor = (bill, stage) => {
  const money = `${Number(bill.amount).toLocaleString('vi-VN')} đ`;
  switch (stage) {
    case 'd-3':
      return { title: 'Sắp đến hạn thanh toán', body: `${bill.title} (${money}) đến hạn trong 3 ngày tới.` };
    case 'd-1':
      return { title: 'Ngày mai đến hạn', body: `${bill.title} (${money}) đến hạn vào ngày mai.` };
    case 'd0':
      return { title: 'Hôm nay đến hạn', body: `${bill.title} (${money}) đến hạn hôm nay.` };
    default:
      return { title: 'Hóa đơn quá hạn', body: `${bill.title} (${money}) đã quá hạn thanh toán.` };
  }
};

/**
 * Quét hóa đơn chưa trả và gửi thông báo theo từng mốc (mỗi mốc 1 lần).
 * Quá hạn chỉ nhắc 1 lần để không làm phiền.
 * @returns {Promise<number>} số hóa đơn đã gửi thông báo
 */
const run = async (now = new Date()) => {
  // Chỉ lấy hóa đơn đến hạn trong vòng 3 ngày tới hoặc đã quá hạn
  const limit = new Date(now.getTime() + 4 * DAY_MS);
  const bills = await BillReminder.find({ status: 'pending', dueDate: { $lte: limit } });
  let sent = 0;

  for (const bill of bills) {
    const stage = stageFor(dayDiff(bill.dueDate, now));
    if (!stage || (bill.notifiedStages || []).includes(stage)) continue;

    // Khóa mốc trước khi gửi để tránh gửi trùng khi có nhiều tiến trình
    const claimed = await BillReminder.findOneAndUpdate(
      { _id: bill._id, status: 'pending', notifiedStages: { $ne: stage } },
      { $addToSet: { notifiedStages: stage } }
    );
    if (!claimed) continue;

    try {
      const { title, body } = messageFor(bill, stage);
      const n = await push.sendToUser(bill.userId, { title, body, data: { type: 'bill_reminder', billId: String(bill._id) } });
      if (n > 0) sent += 1;
    } catch (e) {
      console.error('[billReminder.job] gửi lỗi:', e.message);
    }
  }
  return sent;
};

const start = () => {
  cron.schedule('0 8 * * *', () => run().catch((e) => console.error('[billReminder.job] lỗi:', e.message)), {
    timezone: TZ,
  });
};

module.exports = { start, run, dayDiff, stageFor };
