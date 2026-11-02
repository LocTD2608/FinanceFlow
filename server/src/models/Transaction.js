const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: function () {
        return !['transfer', 'transfer_out', 'transfer_in', 'p2p_out', 'p2p_in'].includes(this.type);
      },
    },
    // Chỉ có giá trị khi type === 'transfer'
    destinationWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      default: null,
    },
    // Người dùng đối tác trong giao dịch P2P
    counterpartyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    counterpartUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    counterpartName: {
      type: String,
      trim: true,
      default: '',
    },
    transferNote: {
      type: String,
      trim: true,
      default: '',
    },
    // Gom các bút toán liên quan (ví dụ P2P, Goal)
    groupId: {
      type: String,
      trim: true,
      default: null,
    },
    // Nguồn gốc phát sinh giao dịch
    source: {
      type: String,
      enum: ['manual', 'p2p', 'goal'],
      default: 'manual',
    },
    // Liên kết với mục tiêu tài chính nếu source === 'goal'
    goalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Goal',
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền là bắt buộc'],
      min: [0, 'Số tiền không được âm'],
    },
    type: {
      type: String,
      enum: ['expense', 'income', 'transfer', 'transfer_out', 'transfer_in', 'p2p_out', 'p2p_in'],
      required: true,
    },
    transactionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    receiptImageUrl: {
      type: String,
      default: null,
    },
    // Khóa chống trùng khi retry (bấm đúp, mất mạng gửi lại). Chỉ duy nhất theo user khi có giá trị.
    idempotencyKey: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'transactions',
  }
);

// Indexes để tối ưu truy vấn
transactionSchema.index({ userId: 1, transactionDate: -1 }); // Hiển thị giao dịch gần nhất
transactionSchema.index({ userId: 1, categoryId: 1, transactionDate: -1 }); // Tính ngân sách & biểu đồ
transactionSchema.index({ userId: 1, amount: -1 }); // Top khoản chi lớn nhất
transactionSchema.index({ groupId: 1 }, { sparse: true });
transactionSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('Transaction', transactionSchema);
