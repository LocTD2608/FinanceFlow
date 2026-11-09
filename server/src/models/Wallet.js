const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Tên ví là bắt buộc'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['cash', 'bank', 'credit_card', 'savings', 'investment'],
      required: true,
      default: 'cash',
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      default: 'VND',
    },
    accountNumber: {
      type: String,
      trim: true,
      // Không set default null — để field vắng mặt hoàn toàn khi chưa thiết lập STK
      // (sparse index chỉ skip field bị missing, không skip null)
    },
    bankName: {
      type: String,
      trim: true,
      default: null,
    },
    isExcludedFromNetWorth: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    // Lưu vết lần user chỉnh số dư trực tiếp (không tạo giao dịch)
    lastManualAdjustment: {
      from: { type: Number },
      to: { type: Number },
      at: { type: Date },
    },
  },
  {
    timestamps: true,
    collection: 'wallets',
  }
);

// Indexes
walletSchema.index({ userId: 1, isArchived: 1 });
// Chỉ enforce unique khi accountNumber là string thật (bỏ qua null/undefined)
walletSchema.index(
  { accountNumber: 1 },
  { unique: true, partialFilterExpression: { accountNumber: { $type: 'string' } } }
);

module.exports = mongoose.model('Wallet', walletSchema);
