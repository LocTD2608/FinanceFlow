require('dotenv').config();
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const categoryRoutes = require('./routes/category.routes');
const transactionRoutes = require('./routes/transaction.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

// 1. Xác thực người dùng (Đăng ký, Đăng nhập thường & Mạng xã hội)
app.use('/api/auth', authRoutes);

// 2. Quản lý danh mục (CRUD, yêu cầu đăng nhập)
app.use('/api/categories', categoryRoutes);

// 3. Quản lý giao dịch thu / chi / chuyển khoản & số dư ví
app.use('/api/transactions', transactionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'FinanceFlow API đang hoạt động ✅', env: process.env.NODE_ENV });
});

// ──────────────────────────────────────────────
// Khởi động server
// ──────────────────────────────────────────────
const start = async () => {
  await connectDB(); // Kết nối MongoDB trước khi mở cổng
  app.listen(PORT, () => {
    console.log(`🚀 FinanceFlow Backend đang chạy tại http://localhost:${PORT}`);
  });
};

if (require.main === module) {
  start();
}

module.exports = app;
