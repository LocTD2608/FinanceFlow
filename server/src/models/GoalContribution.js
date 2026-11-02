const mongoose = require('mongoose');

const goalContributionSchema = new mongoose.Schema(
  {
    goalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Goal',
      required: true,
    },
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
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Số tiền tiết kiệm là bắt buộc'],
      min: [1, 'Số tiền tiết kiệm phải lớn hơn 0'],
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'goal_contributions',
  }
);

goalContributionSchema.index({ goalId: 1, date: -1 });
goalContributionSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('GoalContribution', goalContributionSchema);
