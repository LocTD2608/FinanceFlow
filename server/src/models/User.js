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
      required: [
        function () {
          return !this.authProvider || this.authProvider === 'local';
        },
        'Password hash là bắt buộc',
      ],
    },
    authProvider: {
      type: String,
      enum: {
        values: ['local', 'google', 'apple', 'facebook'],
        message: '{VALUE} không phải là authProvider hợp lệ',
      },
      default: 'local',
    },
    oauthId: {
      type: String,
      default: null,
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
    // Expo push token của các thiết bị đã đăng nhập (để gửi nhắc hóa đơn)
    pushTokens: {
      type: [
        {
          _id: false,
          token: { type: String, required: true },
          platform: { type: String, default: 'unknown' },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt & updatedAt
    collection: 'users',
  }
);

// Index
userSchema.index({ phone: 1 }, { sparse: true });
userSchema.index({ oauthId: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
