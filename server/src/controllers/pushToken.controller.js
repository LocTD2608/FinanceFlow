const User = require('../models/User');

/**
 * POST /api/auth/push-token  { token, platform }
 */
const register = async (req, res) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    if (!/^(Expo|Exponent)PushToken\[.+\]$/.test(token)) {
      return res.status(400).json({ success: false, message: 'Expo push token không hợp lệ.' });
    }
    const platform = typeof req.body.platform === 'string' ? req.body.platform : 'unknown';

    // Một token chỉ thuộc về 1 user (thiết bị đổi tài khoản)
    await User.updateMany({ _id: { $ne: req.user.id } }, { $pull: { pushTokens: { token } } });
    await User.updateOne({ _id: req.user.id }, { $pull: { pushTokens: { token } } });
    await User.updateOne({ _id: req.user.id }, { $push: { pushTokens: { token, platform, updatedAt: new Date() } } });

    return res.status(201).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/auth/push-token  { token }  (gọi khi đăng xuất)
 */
const unregister = async (req, res) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    if (!token) return res.status(400).json({ success: false, message: 'Thiếu token.' });
    await User.updateOne({ _id: req.user.id }, { $pull: { pushTokens: { token } } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, unregister };
