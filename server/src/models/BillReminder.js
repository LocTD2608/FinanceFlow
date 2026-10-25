const mongoose = require('mongoose');

const billReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Tiêu đề nhắc hóa đơn là bắt buộc'],
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    repeatCycle: {
      type: String,
      enum: ['monthly', 'weekly', 'none'],
      default: 'monthly',
    },
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    // Các mốc đã gửi thông báo cho kỳ hiện tại: 'd-3', 'd-1', 'd0', 'overdue' (tránh gửi trùng)
    notifiedStages: {
      type: [String],
      default: [],
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'bill_reminders',
  }
);

// Index để truy vấn danh sách nhắc nhở theo ngày đến hạn
billReminderSchema.index({ userId: 1, dueDate: 1 });
billReminderSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('BillReminder', billReminderSchema);
