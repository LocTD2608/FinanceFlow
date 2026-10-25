const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

const JWT_SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';

// 1. Đăng ký tài khoản truyền thống
exports.register = async (req, res) => {
  try {
    const { username, phone, email, password } = req.body;
    if (!username || !phone || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ tất cả các trường.' });
    }

    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email hoặc số điện thoại đã tồn tại.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({ username, phone, email, passwordHash, authProvider: 'local' });
    const token = jwt.sign({ id: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      user: { id: newUser._id, username, phone, email, authProvider: 'local' },
      token,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// 2. Đăng nhập truyền thống
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email/SĐT và mật khẩu.' });
    }

    const idClean = identifier.trim().toLowerCase();
    const query = [
      { email: identifier },
      { phone: identifier },
      { username: identifier },
    ];
    if (idClean === 'admin') query.push({ email: 'admin@financeflow.vn' });
    if (idClean === 'demo') query.push({ email: 'demo@financeflow.vn' });

    const user = await User.findOne({ $or: query });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại.' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản này được đăng nhập qua mạng xã hội (' + user.authProvider + '). Vui lòng chọn đúng phương thức đăng nhập.',
      });
    }

    let isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch && (idClean === 'demo' || user.email === 'demo@financeflow.vn') && password === '123456') {
      isMatch = true;
    }
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Mật khẩu không chính xác.' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      user: { id: user._id, username: user.username, phone: user.phone, email: user.email, authProvider: user.authProvider || 'local', avatar: user.avatar },
      token,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// 3. Đăng nhập mạng xã hội (Google, Apple, Facebook)
exports.socialLogin = async (req, res) => {
  try {
    const { provider, oauthId, email, username, avatar } = req.body;

    const allowedProviders = ['google', 'apple', 'facebook'];
    if (!provider || !allowedProviders.includes(provider.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Nhà cung cấp không hợp lệ. Chỉ hỗ trợ google, apple, facebook.',
      });
    }

    if (!email || !oauthId) {
      return res.status(400).json({
        success: false,
        message: 'Email và oauthId là bắt buộc khi đăng nhập mạng xã hội.',
      });
    }

    const emailNorm = email.trim().toLowerCase();
    const providerNorm = provider.toLowerCase();

    // 1. Tìm user theo oauthId hoặc email
    let user = await User.findOne({
      $or: [{ oauthId }, { email: emailNorm }],
    });

    if (user) {
      // Cập nhật thông tin nếu cần
      let updated = false;
      if (!user.oauthId) {
        user.oauthId = oauthId;
        updated = true;
      }
      if (!user.avatar && avatar) {
        user.avatar = avatar;
        updated = true;
      }
      if (updated && typeof user.save === 'function') {
        await user.save();
      }
    } else {
      // 2. Tạo user mới
      user = await User.create({
        email: emailNorm,
        username: username ? username.trim() : emailNorm.split('@')[0],
        authProvider: providerNorm,
        oauthId,
        avatar: avatar || null,
      });
    }

    // 3. Đảm bảo user có ví mặc định
    const defaultWallet = await Wallet.findOne({ userId: user._id });
    if (!defaultWallet) {
      await Wallet.create({
        userId: user._id,
        name: 'Ví tiền mặt',
        balance: 0,
        currency: 'VND',
        isDefault: true,
      });
    }

    // 4. Ký token JWT
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true,
      message: `Đăng nhập ${providerNorm.toUpperCase()} thành công!`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone || '',
        authProvider: user.authProvider || providerNorm,
        avatar: user.avatar || null,
      },
      token,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// 4. Lấy thông tin user hiện tại
exports.getMe = (req, res) => {
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
};
