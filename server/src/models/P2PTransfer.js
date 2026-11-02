const mongoose = require('mongoose');

const p2pTransferSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    receiverWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền chuyển là bắt buộc'],
      min: [1, 'Số tiền chuyển tối thiểu là 1'],
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'success',
    },
    groupId: {
      type: String,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'p2p_transfers',
  }
);

// Indexes
p2pTransferSchema.index({ senderId: 1, createdAt: -1 });
p2pTransferSchema.index({ receiverId: 1, createdAt: -1 });
p2pTransferSchema.index(
  { senderId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

module.exports = mongoose.model('P2PTransfer', p2pTransferSchema);
