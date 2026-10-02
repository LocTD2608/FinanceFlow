const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    limitAmount: {
      type: Number,
      required: [true, 'Hạn mức ngân sách là bắt buộc'],
      min: [0, 'Hạn mức không được âm'],
    },
    // Tháng áp dụng ngân sách, định dạng YYYY-MM
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Định dạng tháng phải là YYYY-MM'],
    },
    period: {
      type: String,
      enum: ['monthly', 'salary_cycle'],
      default: 'monthly',
    },
    // Bật / tắt cảnh báo tại các mốc 50%, 80%, 100%
    alertThreshold50: {
      type: Boolean,
      default: true,
    },
    alertThreshold80: {
      type: Boolean,
      default: true,
    },
    alertThreshold100: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'budgets',
  }
);

// Unique compound index: mỗi user chỉ có 1 budget/category/tháng
budgetSchema.index({ userId: 1, month: 1, categoryId: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
