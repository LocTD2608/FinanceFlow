const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    // null = danh mục mặc định của hệ thống, ObjectId = danh mục người dùng tự tạo
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Tên danh mục là bắt buộc'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['expense', 'income'],
      required: true,
    },
    icon: {
      type: String,
      default: 'circle',
    },
    color: {
      type: String,
      default: '#6B7280',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'categories',
  }
);

// Indexes
categorySchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Category', categorySchema);
