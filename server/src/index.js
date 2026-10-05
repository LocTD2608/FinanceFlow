require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/db');
const User = require('./models/User');
const categoryRoutes = require('./routes/category.routes');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';

app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

// 1. Đăng ký tài khoản
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, phone, email, password } = req.body;
    if (!username || !phone || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ tất cả các trường.' });
    }

    // Kiểm tra email / SĐT đã tồn tại
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email hoặc số điện thoại đã tồn tại.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({ username, phone, email, passwordHash });
    const token = jwt.sign({ id: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      user: { id: newUser._id, username, phone, email },
      token,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
});

// 2. Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier là email hoặc số điện thoại
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email/SĐT và mật khẩu.' });
    }

    const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không chính xác.' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      user: { id: user._id, username: user.username, phone: user.phone, email: user.email },
      token,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
});

// 3. Lấy thông tin user hiện tại (protected)
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Chưa được xác thực.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ success: true, user: decoded });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
});

// 4. Quản lý danh mục (CRUD, yêu cầu đăng nhập)
app.use('/api/categories', categoryRoutes);

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

start();
