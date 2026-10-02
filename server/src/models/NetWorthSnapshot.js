const mongoose = require('mongoose');

const netWorthSnapshotSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Tháng chụp ảnh tài sản, định dạng YYYY-MM
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Định dạng tháng phải là YYYY-MM'],
    },
    totalAssets: {
      type: Number,
      required: true,
      default: 0,
    },
    totalLiabilities: {
      type: Number,
      required: true,
      default: 0,
    },
    // netWorth = totalAssets - totalLiabilities (tính sẵn để query nhanh)
    netWorth: {
      type: Number,
      required: true,
      default: 0,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'net_worth_snapshots',
  }
);

// Unique compound index: mỗi user chỉ có 1 snapshot/tháng
netWorthSnapshotSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('NetWorthSnapshot', netWorthSnapshotSchema);
