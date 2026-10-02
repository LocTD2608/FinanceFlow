const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash là bắt buộc'],
    },
    nickname: {
      type: String,
      trim: true,
      default: '',
    },
    // Trường bổ sung từ form đăng ký hiện tại
    username: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    avatar: {
      type: String,
      default: null,
    },
    baseCurrency: {
      type: String,
      enum: ['VND', 'USD', 'EUR'],
      default: 'VND',
    },
    startOfWeek: {
      type: String,
      enum: ['monday', 'sunday'],
      default: 'monday',
    },
    salaryDay: {
      type: Number,
      min: 1,
      max: 31,
      default: 5,
    },
    theme: {
      type: String,
      enum: ['dark', 'light'],
      default: 'dark',
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt & updatedAt
    collection: 'users',
  }
);

// Index
// email unique index đã được khai báo qua { unique: true } trong schema → không cần .index() thêm
userSchema.index({ phone: 1 }, { sparse: true }); // sparse vì phone có thể null/empty

module.exports = mongoose.model('User', userSchema);
