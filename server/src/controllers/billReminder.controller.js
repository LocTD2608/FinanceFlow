const mongoose = require('mongoose');
const BillReminder = require('../models/BillReminder');
const Wallet = require('../models/Wallet');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const { applyDeltas, insufficientBody } = require('../utils/walletBalance');
const { findCategoryForType } = require('../utils/categoryRules');

const MAX_AMOUNT = 100000000;
const CYCLES = ['monthly', 'weekly', 'none'];
const DEFAULT_BILL_CATEGORY = 'Hóa đơn & Tiện ích';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Tính ngày đến hạn kế tiếp. Hàng tháng: cộng 1 tháng (cắt về cuối tháng nếu tháng sau ngắn hơn).
 */
const nextDueDate = (dueDate, cycle) => {
  const d = new Date(dueDate);
  if (cycle === 'weekly') return new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (cycle !== 'monthly') return null;
  const local = new Date(d.getTime() + VN_OFFSET_MS);
  const day = local.getUTCDate();
  const target = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1, local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return new Date(target.getTime() - VN_OFFSET_MS);
};

const parseBody = (b, partial = false) => {
  const out = {};
  const errors = [];
  if (!partial || b.title !== undefined) {
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    if (!title || title.length > 100) errors.push('Tiêu đề là bắt buộc (tối đa 100 ký tự).');
    out.title = title;
  }
  if (!partial || b.amount !== undefined) {
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) errors.push('Số tiền không hợp lệ.');
    out.amount = amount;
  }
  if (!partial || b.dueDate !== undefined) {
    const due = new Date(b.dueDate);
    if (!b.dueDate || Number.isNaN(due.getTime())) errors.push('Ngày đến hạn không hợp lệ.');
    out.dueDate = due;
  }
  if (b.repeatCycle !== undefined) {
    if (!CYCLES.includes(b.repeatCycle)) errors.push('Chu kỳ lặp không hợp lệ.');
    out.repeatCycle = b.repeatCycle;
  }
  return { out, errors };
};

/** GET /api/bill-reminders?status=pending|paid */
const list = async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    if (['pending', 'paid'].includes(req.query.status)) filter.status = req.query.status;
    const data = await BillReminder.find(filter).sort({ dueDate: 1 });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/bill-reminders */
const create = async (req, res) => {
  try {
    const { out, errors } = parseBody(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
    const data = await BillReminder.create({ ...out, userId: req.user.id });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** PATCH /api/bill-reminders/:id */
const update = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Mã không hợp lệ.' });
    const { out, errors } = parseBody(req.body, true);
    if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
    if (!Object.keys(out).length) return res.status(400).json({ success: false, message: 'Không có dữ liệu cập nhật.' });

    const update = { ...out };
    // Đổi hạn thanh toán thì cho phép nhắc lại từ đầu
    if (out.dueDate) update.notifiedStages = [];

    const data = await BillReminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, status: 'pending' },
      { $set: update },
      { new: true }
    );
    if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy nhắc nhở đang chờ.' });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** DELETE /api/bill-reminders/:id */
const remove = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Mã không hợp lệ.' });
    const data = await BillReminder.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy nhắc nhở.' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/bill-reminders/:id/pay  { walletId, categoryId? }
 * Tạo giao dịch chi, đánh dấu đã trả và tạo kỳ kế tiếp nếu có lặp.
 */
const pay = async (req, res) => {
  try {
    const { id } = req.params;
    const { walletId, categoryId } = req.body;
    if (!isValidId(id) || !isValidId(walletId)) {
      return res.status(400).json({ success: false, message: 'Hóa đơn hoặc ví không hợp lệ.' });
    }

    const wallet = await Wallet.findOne({ _id: walletId, userId: req.user.id, isArchived: { $ne: true } });
    if (!wallet) return res.status(404).json({ success: false, message: 'Không tìm thấy ví.' });

    let category;
    if (categoryId) {
      if (!isValidId(categoryId)) return res.status(400).json({ success: false, message: 'Danh mục không hợp lệ.' });
      const found = await findCategoryForType(req.user.id, categoryId, 'expense');
      if (!found.category) return res.status(found.status).json({ success: false, message: found.message });
      category = found.category;
    } else {
      category = await Category.findOne({ name: DEFAULT_BILL_CATEGORY, type: 'expense', isDefault: true, userId: null });
      if (!category) return res.status(500).json({ success: false, message: `Thiếu danh mục mặc định "${DEFAULT_BILL_CATEGORY}".` });
    }

    // Khóa hóa đơn (chỉ 1 request trả thành công)
    const bill = await BillReminder.findOneAndUpdate(
      { _id: id, userId: req.user.id, status: 'pending' },
      { $set: { status: 'paid', paidAt: new Date() } },
      { new: true }
    );
    if (!bill) return res.status(404).json({ success: false, message: 'Hóa đơn không tồn tại hoặc đã thanh toán.' });

    const revertBill = () =>
      BillReminder.updateOne({ _id: bill._id }, { $set: { status: 'pending', paidAt: null } });

    const result = await applyDeltas([{ walletId, delta: -bill.amount }]);
    if (!result.ok) {
      await revertBill();
      const fresh = await Wallet.findById(walletId);
      return res.status(400).json(insufficientBody(fresh ? fresh.balance : wallet.balance, bill.amount));
    }

    let tx;
    try {
      tx = await Transaction.create({
        userId: req.user.id,
        walletId,
        categoryId: category._id,
        amount: bill.amount,
        type: 'expense',
        note: `Thanh toán: ${bill.title}`.slice(0, 100),
        idempotencyKey: `bill-${bill._id}-${new Date(bill.dueDate).getTime()}`,
      });
    } catch (e) {
      await applyDeltas([{ walletId, delta: bill.amount }]);
      await revertBill();
      throw e;
    }

    let next = null;
    const nextDue = nextDueDate(bill.dueDate, bill.repeatCycle);
    if (nextDue) {
      next = await BillReminder.create({
        userId: req.user.id,
        title: bill.title,
        amount: bill.amount,
        dueDate: nextDue,
        repeatCycle: bill.repeatCycle,
      });
    }

    return res.status(201).json({ success: true, data: { bill, transaction: tx, next } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { list, create, update, remove, pay, nextDueDate };
