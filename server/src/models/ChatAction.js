const mongoose = require('mongoose');

const chatActionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId là bắt buộc'],
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatConversation',
      required: [true, 'conversationId là bắt buộc'],
      index: true,
    },
    type: {
      type: String,
      enum: ['create_transaction', 'create_budget'],
      required: [true, 'Loại action là bắt buộc'],
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'payload là bắt buộc'],
    },
    preview: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'preview là bắt buộc'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'expired'],
      default: 'pending',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'expiresAt là bắt buộc'],
      index: true,
    },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    resultSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'chat_actions',
  }
);

chatActionSchema.index({ conversationId: 1, status: 1 });
chatActionSchema.index({ userId: 1, status: 1 });
chatActionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model('ChatAction', chatActionSchema);
