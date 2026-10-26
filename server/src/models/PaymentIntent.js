const mongoose = require('mongoose');

/**
 * Yêu cầu thanh toán QR. OTP được server sinh, gửi qua email và chỉ lưu dạng hash.
 * Giao dịch chi chỉ được ghi nhận sau khi user nhập đúng OTP (confirm).
 */
const paymentIntentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String, trim: true, default: '' },
    // Dành cho cổng thanh toán thật sau này (SePay, VNPay, MoMo...)
    provider: { type: String, enum: ['mock', 'sepay', 'vnpay', 'momo'], default: 'mock' },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    // Số lần đã gửi OTP (gồm lần đầu) và thời điểm gửi gần nhất, để giới hạn gửi lại
    sendCount: { type: Number, default: 1 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'expired', 'failed'],
      default: 'pending',
    },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  },
  { timestamps: true, collection: 'payment_intents' }
);

paymentIntentSchema.index({ userId: 1, status: 1 });
// Tự xóa intent sau 1 ngày kể từ khi hết hạn
paymentIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
