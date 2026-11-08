const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Tên mục tiêu là bắt buộc'],
      trim: true,
    },
    targetAmount: {
      type: Number,
      required: [true, 'Số tiền mục tiêu là bắt buộc'],
      min: [1, 'Số tiền mục tiêu phải lớn hơn 0'],
    },
    currentAmount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Số tiền hiện tại không được âm'],
    },
    deadline: {
      type: Date,
      default: null,
    },
    icon: {
      type: String,
      default: 'target',
      trim: true,
    },
    color: {
      type: String,
      default: '#F59E0B',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    // Ví thụ hưởng tiền hoàn lại khi hoàn thành hoặc hủy mục tiêu
    targetWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    // Phí hủy phạt 5% nếu hủy trước hạn
    penaltyFee: {
      type: Number,
      default: 0,
    },
    // Số tiền hoàn trả về ví (100% khi completed, 95% khi cancelled)
    refundAmount: {
      type: Number,
      default: 0,
    },
    // Các mốc cận hạn đã nhắc nhở: ['d-7', 'd-3', 'd0']
    notifiedStages: {
      type: [String],
      default: [],
    },
    // Tháng đã gửi nhắc nhở định kỳ theo ngày nhận lương (YYYY-MM)
    lastSalaryReminderMonth: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'goals',
  }
);

goalSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Goal', goalSchema);
