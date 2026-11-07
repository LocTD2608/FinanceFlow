const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
    facts: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    actionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatAction',
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const chatConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId là bắt buộc'],
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: 'Hội thoại tài chính',
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    pendingActionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatAction',
      default: null,
    },
    actionVersion: { type: Number, default: 0 },
    activeActionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatAction',
      default: null,
    },
    lockToken: {
      type: String,
      default: null,
    },
    lockUntil: {
      type: Date,
      default: () => new Date(0),
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 86400000),
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'chat_conversations',
  }
);

chatConversationSchema.index({ userId: 1, updatedAt: -1 });
chatConversationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
