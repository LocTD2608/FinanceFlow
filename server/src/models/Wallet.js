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
      default: null,
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
  },
  {
    timestamps: true,
    collection: 'wallets',
  }
);

// Indexes
walletSchema.index({ userId: 1, isArchived: 1 });

module.exports = mongoose.model('Wallet', walletSchema);
