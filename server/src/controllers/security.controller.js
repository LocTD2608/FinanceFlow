const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const mailService = require('../services/mail.service');

const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const hashOtp = (otp) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'financeflow').update(String(otp)).digest('hex');

const safeTimingEqual = (aHex, bHex) => {
  if (!aHex || !bHex) return false;
  const bufA = Buffer.from(aHex, 'hex');
  const bufB = Buffer.from(bHex, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

/**
 * GET /api/security/pin/status
 * Trả về trạng thái mã PIN và sinh trắc học của user
 */
const getPinStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    const now = Date.now();
    const isLocked = Boolean(user.pinLockedUntil && new Date(user.pinLockedUntil).getTime() > now);
    const lockRemainingSeconds = isLocked
      ? Math.max(0, Math.ceil((new Date(user.pinLockedUntil).getTime() - now) / 1000))
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        hasPin: Boolean(user.transactionPinHash),
        isLocked,
        lockRemainingSeconds,
        biometricEnabled: Boolean(user.biometricEnabled),
      },
    });
  } catch (error) {
    console.error('getPinStatus error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
  }
};

/**
 * POST /api/security/pin/setup
 * Thiết lập mã PIN lần đầu (6 chữ số)
 * Body: { pin, confirmPin }
 */
const setupPin = async (req, res) => {
  try {
    const { pin, confirmPin } = req.body;

    if (!pin || !/^\d{6}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        message: 'Mã PIN phải bao gồm đúng 6 chữ số.',
      });
    }

    if (confirmPin !== undefined && String(pin) !== String(confirmPin)) {
      return res.status(400).json({
        success: false,
        message: 'Mã xác nhận PIN không khớp.',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    if (user.transactionPinHash) {
      return res.status(400).json({
        success: false,
        message: 'Mã PIN đã được thiết lập trước đó. Vui lòng chọn đổi mã PIN.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.transactionPinHash = await bcrypt.hash(String(pin), salt);
    user.failedPinAttempts = 0;
    user.pinLockedUntil = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Thiết lập mã PIN thành công.',
    });
  } catch (error) {
    console.error('setupPin error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
  }
};

/**
 * POST /api/security/pin/verify
 * Xác thực mã PIN giao dịch kèm cơ chế chống brute-force
 * Body: { pin }
 */
const verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || !/^\d{6}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        message: 'Mã PIN phải bao gồm đúng 6 chữ số.',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    if (!user.transactionPinHash) {
      return res.status(400).json({
        success: false,
        message: 'Chưa thiết lập mã PIN giao dịch.',
      });
    }

    const now = Date.now();
    // 1. Kiểm tra tài khoản có đang bị khóa PIN không
    if (user.pinLockedUntil && new Date(user.pinLockedUntil).getTime() > now) {
      const lockRemainingSeconds = Math.max(
        0,
        Math.ceil((new Date(user.pinLockedUntil).getTime() - now) / 1000)
      );
      return res.status(403).json({
        success: false,
        code: 'PIN_LOCKED',
        message: `Mã PIN đang bị tạm khóa. Vui lòng thử lại sau ${lockRemainingSeconds} giây hoặc khôi phục mã PIN.`,
        lockRemainingSeconds,
      });
    }

    // 2. So khớp mã PIN với bcrypt hash
    const isMatch = await bcrypt.compare(String(pin), user.transactionPinHash);
    if (!isMatch) {
      user.failedPinAttempts = (user.failedPinAttempts || 0) + 1;

      if (user.failedPinAttempts >= MAX_ATTEMPTS) {
        user.pinLockedUntil = new Date(now + LOCK_TIME_MS);
        await user.save();
        return res.status(429).json({
          success: false,
          code: 'PIN_LOCKED',
          message: 'Bạn đã nhập sai mã PIN 5 lần liên tiếp. Tài khoản bị tạm khóa 15 phút.',
          lockRemainingSeconds: Math.ceil(LOCK_TIME_MS / 1000),
          attemptsLeft: 0,
        });
      }

      const attemptsLeft = MAX_ATTEMPTS - user.failedPinAttempts;
      await user.save();
      return res.status(400).json({
        success: false,
        code: 'PIN_INVALID',
        message: `Mã PIN không chính xác. Bạn còn ${attemptsLeft} lần thử.`,
        attemptsLeft,
      });
    }

    // 3. Đúng PIN: Reset số lần thử sai và gỡ khóa nếu có
    user.failedPinAttempts = 0;
    user.pinLockedUntil = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Xác thực mã PIN thành công.',
    });
  } catch (error) {
    console.error('verifyPin error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
  }
};

/**
 * POST /api/security/pin/change
 * Đổi mã PIN (yêu cầu mã PIN cũ)
 * Body: { oldPin, newPin, confirmPin / confirmNewPin }
 */
const changePin = async (req, res) => {
  try {
    const { oldPin, newPin, confirmPin, confirmNewPin } = req.body;
    const confirm = confirmNewPin !== undefined ? confirmNewPin : confirmPin;

    if (!oldPin || !/^\d{6}$/.test(String(oldPin))) {
      return res.status(400).json({
        success: false,
        message: 'Mã PIN cũ không hợp lệ.',
      });
    }

    if (!newPin || !/^\d{6}$/.test(String(newPin))) {
      return res.status(400).json({
        success: false,
        message: 'Mã PIN mới phải bao gồm đúng 6 chữ số.',
      });
    }

    if (confirm !== undefined && String(newPin) !== String(confirm)) {
      return res.status(400).json({
        success: false,
        message: 'Mã xác nhận PIN không khớp.',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    if (!user.transactionPinHash) {
      return res.status(400).json({
        success: false,
        message: 'Chưa thiết lập mã PIN giao dịch.',
      });
    }

    const now = Date.now();
    if (user.pinLockedUntil && new Date(user.pinLockedUntil).getTime() > now) {
      const lockRemainingSeconds = Math.max(
        0,
        Math.ceil((new Date(user.pinLockedUntil).getTime() - now) / 1000)
      );
      return res.status(403).json({
        success: false,
        code: 'PIN_LOCKED',
        message: `Mã PIN đang bị tạm khóa. Vui lòng thử lại sau ${lockRemainingSeconds} giây.`,
        lockRemainingSeconds,
      });
    }

    const isMatch = await bcrypt.compare(String(oldPin), user.transactionPinHash);
    if (!isMatch) {
      user.failedPinAttempts = (user.failedPinAttempts || 0) + 1;
      if (user.failedPinAttempts >= MAX_ATTEMPTS) {
        user.pinLockedUntil = new Date(now + LOCK_TIME_MS);
        await user.save();
        return res.status(429).json({
          success: false,
          code: 'PIN_LOCKED',
          message: 'Bạn đã nhập sai mã PIN 5 lần liên tiếp. Tài khoản bị tạm khóa 15 phút.',
          lockRemainingSeconds: Math.ceil(LOCK_TIME_MS / 1000),
          attemptsLeft: 0,
        });
      }
      const attemptsLeft = MAX_ATTEMPTS - user.failedPinAttempts;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Mã PIN cũ không chính xác.',
        attemptsLeft,
      });
    }

    if (String(oldPin) === String(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'Mã PIN mới không được trùng với mã PIN hiện tại.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.transactionPinHash = await bcrypt.hash(String(newPin), salt);
    user.failedPinAttempts = 0;
    user.pinLockedUntil = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Đổi mã PIN thành công.',
    });
  } catch (error) {
    console.error('changePin error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
  }
};

/**
 * POST /api/security/pin/forgot
 * Gửi OTP khôi phục PIN qua email
 */
const forgotPin = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.email) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản chưa có email để nhận mã OTP.',
      });
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    user.pinResetOtpHash = hashOtp(otp);
    user.pinResetOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    await user.save();

    let sendResult = null;
    try {
      sendResult = await mailService.sendOtpEmail(user.email, otp, { ttlMinutes: 10 });
    } catch (err) {
      console.error('Gửi email OTP khôi phục PIN thất bại:', err.message);
      return res.status(502).json({
        success: false,
        message: 'Không thể gửi email OTP lúc này. Vui lòng thử lại sau.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Mã OTP khôi phục mã PIN đã được gửi tới email của bạn.',
      email: mailService.maskEmail(user.email),
      devOtp: sendResult?.isDev ? otp : undefined,
    });
  } catch (error) {
    console.error('forgotPin error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
  }
};

/**
 * POST /api/security/pin/reset-with-otp
 * Xác thực OTP và đặt lại mã PIN mới, giải phóng khóa
 * Body: { otp, newPin, confirmPin / confirmNewPin }
 */
const resetPinWithOtp = async (req, res) => {
  try {
    const { otp, newPin, confirmPin, confirmNewPin } = req.body;
    const confirm = confirmNewPin !== undefined ? confirmNewPin : confirmPin;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã OTP.',
      });
    }

    if (!newPin || !/^\d{6}$/.test(String(newPin))) {
      return res.status(400).json({
        success: false,
        message: 'Mã PIN mới phải bao gồm đúng 6 chữ số.',
      });
    }

    if (confirm !== undefined && String(newPin) !== String(confirm)) {
      return res.status(400).json({
        success: false,
        message: 'Mã xác nhận PIN không khớp.',
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    if (!user.pinResetOtpHash || !user.pinResetOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Không có yêu cầu đặt lại mã PIN nào đang chờ xử lý hoặc mã OTP không hợp lệ.',
      });
    }

    const now = Date.now();
    if (new Date(user.pinResetOtpExpiresAt).getTime() < now) {
      user.pinResetOtpHash = null;
      user.pinResetOtpExpiresAt = null;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu mã mới.',
      });
    }

    const inputHash = hashOtp(otp);
    if (!safeTimingEqual(inputHash, user.pinResetOtpHash)) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không chính xác.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.transactionPinHash = await bcrypt.hash(String(newPin), salt);
    user.pinResetOtpHash = null;
    user.pinResetOtpExpiresAt = null;
    user.failedPinAttempts = 0;
    user.pinLockedUntil = null; // Mở khóa tài khoản
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Đặt lại mã PIN thành công. Tài khoản đã được mở khóa.',
    });
  } catch (error) {
    console.error('resetPinWithOtp error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
  }
};

/**
 * POST /api/security/pin/biometric/toggle
 * Bật / tắt xác thực sinh trắc học
 * Body: { enabled?: boolean }
 */
const toggleBiometric = async (req, res) => {
  try {
    const { enabled } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    user.biometricEnabled = typeof enabled === 'boolean' ? enabled : !user.biometricEnabled;
    await user.save();

    return res.status(200).json({
      success: true,
      biometricEnabled: user.biometricEnabled,
      message: user.biometricEnabled
        ? 'Đã kích hoạt xác thực sinh trắc học.'
        : 'Đã hủy kích hoạt xác thực sinh trắc học.',
    });
  } catch (error) {
    console.error('toggleBiometric error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ.' });
  }
};

module.exports = {
  getPinStatus,
  setupPin,
  verifyPin,
  changePin,
  forgotPin,
  resetPinWithOtp,
  toggleBiometric,
};
