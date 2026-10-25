const crypto = require('crypto');
const mongoose = require('mongoose');
const PaymentIntent = require('../models/PaymentIntent');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const mailService = require('../services/mail.service');
const { applyDeltas, insufficientBody } = require('../utils/walletBalance');
const { findCategoryForType, validateNoteForCategory } = require('../utils/categoryRules');

const OTP_TTL_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 3;
const RESEND_GAP_MS = 60 * 1000;
const MAX_AMOUNT = 100000000;

const hashOtp = (otp) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'financeflow').update(String(otp)).digest('hex');

const safeEqual = (a, b) => {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const sendOtpToUser = async (userId, otp, amount) => {
  const user = await User.findById(userId);
  if (!user || !user.email) {
    const err = new Error('Tài khoản chưa có email để nhận mã OTP.');
    err.status = 400;
    throw err;
  }
  try {
    await mailService.sendOtpEmail(user.email, otp, { amount, ttlMinutes: OTP_TTL_MS / 60000 });
  } catch (e) {
    console.error('Gửi OTP thất bại:', e.message);
    const err = new Error('Không thể gửi email OTP lúc này. Vui lòng thử lại sau.');
    err.status = 502;
    throw err;
  }
  return mailService.maskEmail(user.email);
};

/**
 * POST /api/payments/intent
 * Body: { walletId, amount, categoryId, note }
 */
const createIntent = async (req, res) => {
  try {
    const { walletId, categoryId } = req.body;
    const amount = Number(req.body.amount);
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

    if (!isValidId(walletId) || !isValidId(categoryId)) {
      return res.status(400).json({ success: false, message: 'Ví hoặc danh mục không hợp lệ.' });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ.' });
    }

    const wallet = await Wallet.findOne({ _id: walletId, userId: req.user.id, isArchived: { $ne: true } });
    if (!wallet) return res.status(404).json({ success: false, message: 'Không tìm thấy ví.' });

    const found = await findCategoryForType(req.user.id, categoryId, 'expense');
    if (!found.category) return res.status(found.status).json({ success: false, message: found.message });

    const noteError = validateNoteForCategory(found.category, note);
    if (noteError) return res.status(400).json({ success: false, message: noteError });

    // Kiểm tra số dư trước khi gửi mail
    if (wallet.type !== 'credit_card' && wallet.balance < amount) {
      return res.status(400).json(insufficientBody(wallet.balance, amount));
    }

    const otp = generateOtp();
    const email = await sendOtpToUser(req.user.id, otp, amount);

    const intent = await PaymentIntent.create({
      userId: req.user.id,
      walletId,
      categoryId,
      amount,
      note,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    return res.status(201).json({
      success: true,
      data: { intentId: intent._id, expiresAt: intent.expiresAt, email },
    });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

const loadIntent = async (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ success: false, message: 'Mã yêu cầu không hợp lệ.' });
    return null;
  }
  const intent = await PaymentIntent.findOne({ _id: req.params.id, userId: req.user.id });
  if (!intent) {
    res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu thanh toán.' });
    return null;
  }
  return intent;
};

/**
 * POST /api/payments/intent/:id/resend
 */
const resendOtp = async (req, res) => {
  try {
    const intent = await loadIntent(req, res);
    if (!intent) return;

    if (intent.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Yêu cầu thanh toán không còn hiệu lực.' });
    }
    if (intent.sendCount >= MAX_SENDS) {
      return res.status(429).json({ success: false, message: 'Bạn đã gửi lại mã quá số lần cho phép.' });
    }
    const wait = intent.lastSentAt.getTime() + RESEND_GAP_MS - Date.now();
    if (wait > 0) {
      return res.status(429).json({
        success: false,
        message: `Vui lòng chờ ${Math.ceil(wait / 1000)} giây để gửi lại mã.`,
        retryAfter: Math.ceil(wait / 1000),
      });
    }

    const otp = generateOtp();
    const email = await sendOtpToUser(req.user.id, otp, intent.amount);

    intent.otpHash = hashOtp(otp);
    intent.attempts = 0;
    intent.sendCount += 1;
    intent.lastSentAt = new Date();
    intent.expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await intent.save();

    return res.json({ success: true, data: { intentId: intent._id, expiresAt: intent.expiresAt, email } });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/payments/intent/:id/confirm
 * Body: { otp }
 */
const confirmIntent = async (req, res) => {
  try {
    const intent = await loadIntent(req, res);
    if (!intent) return;

    const otp = String(req.body.otp || '').trim();
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Mã OTP gồm 6 chữ số.' });
    }

    if (intent.status === 'completed') {
      const tx = intent.transactionId ? await Transaction.findById(intent.transactionId) : null;
      return res.json({ success: true, data: tx, message: 'Giao dịch đã được ghi nhận.' });
    }
    if (intent.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Yêu cầu thanh toán không còn hiệu lực.' });
    }
    if (intent.expiresAt.getTime() <= Date.now()) {
      await PaymentIntent.updateOne({ _id: intent._id, status: 'pending' }, { status: 'expired' });
      return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'Mã OTP đã hết hạn. Vui lòng gửi lại mã.' });
    }

    // Tăng số lần thử nguyên tử để chống dò mã song song
    const updated = await PaymentIntent.findOneAndUpdate(
      { _id: intent._id, status: 'pending', attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!updated) {
      await PaymentIntent.updateOne({ _id: intent._id, status: 'pending' }, { status: 'failed' });
      return res.status(429).json({ success: false, code: 'TOO_MANY_ATTEMPTS', message: 'Nhập sai quá số lần cho phép. Vui lòng tạo giao dịch mới.' });
    }

    if (!safeEqual(hashOtp(otp), updated.otpHash)) {
      const left = MAX_ATTEMPTS - updated.attempts;
      if (left <= 0) {
        await PaymentIntent.updateOne({ _id: intent._id, status: 'pending' }, { status: 'failed' });
        return res.status(429).json({ success: false, code: 'TOO_MANY_ATTEMPTS', message: 'Nhập sai quá số lần cho phép. Vui lòng tạo giao dịch mới.' });
      }
      return res.status(400).json({ success: false, code: 'OTP_INVALID', message: `Mã OTP không đúng. Còn ${left} lần thử.`, attemptsLeft: left });
    }

    // Khóa intent để không thanh toán 2 lần
    const locked = await PaymentIntent.findOneAndUpdate(
      { _id: intent._id, status: 'pending' },
      { status: 'processing' },
      { new: true }
    );
    if (!locked) {
      return res.status(409).json({ success: false, message: 'Yêu cầu đang được xử lý.' });
    }

    const result = await applyDeltas([{ walletId: locked.walletId, delta: -locked.amount }]);
    if (!result.ok) {
      await PaymentIntent.updateOne({ _id: locked._id }, { status: 'pending' });
      const wallet = await Wallet.findById(locked.walletId);
      return res.status(400).json(insufficientBody(wallet ? wallet.balance : 0, locked.amount));
    }

    let tx;
    try {
      tx = await Transaction.create({
        userId: locked.userId,
        walletId: locked.walletId,
        categoryId: locked.categoryId,
        amount: locked.amount,
        type: 'expense',
        note: locked.note,
        idempotencyKey: `payment-intent-${locked._id}`,
      });
    } catch (e) {
      // Hoàn lại tiền và cho phép thử lại
      await applyDeltas([{ walletId: locked.walletId, delta: locked.amount }]);
      await PaymentIntent.updateOne({ _id: locked._id }, { status: 'pending' });
      throw e;
    }

    await PaymentIntent.updateOne({ _id: locked._id }, { status: 'completed', transactionId: tx._id });
    return res.status(201).json({ success: true, data: tx });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

module.exports = { createIntent, resendOtp, confirmIntent, hashOtp };
