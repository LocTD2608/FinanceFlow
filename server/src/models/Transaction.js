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
      required: true,
    },
    // Chỉ có giá trị khi type === 'transfer'
    destinationWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền là bắt buộc'],
      min: [0, 'Số tiền không được âm'],
    },
    type: {
      type: String,
      enum: ['expense', 'income', 'transfer'],
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

module.exports = mongoose.model('Transaction', transactionSchema);
