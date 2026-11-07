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
    kind: {
      type: String,
      enum: ['create_transaction', 'create_budget'],
      required: function() { return !this.type; },
    },
    type: {
      type: String,
      enum: ['create_transaction', 'create_budget'],
      required: function() { return !this.kind; },
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
    purgeAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 86400000),
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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

chatActionSchema.pre('validate', function(next) {
  if (this.kind && !this.type) this.type = this.kind;
  if (this.type && !this.kind) this.kind = this.type;
  next();
});

chatActionSchema.index({ conversationId: 1, status: 1 });
chatActionSchema.index({ userId: 1, status: 1 });
chatActionSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ChatAction', chatActionSchema);
