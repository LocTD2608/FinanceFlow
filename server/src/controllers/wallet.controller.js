const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * GET /api/wallets - Lấy danh sách ví của người dùng
 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    let wallets = await Wallet.find({ userId, isArchived: { $ne: true } }).sort({ createdAt: 1 });

    // Nếu user chưa có ví nào (ví dụ đăng ký trước đó), tự động tạo 1 ví tiền mặt mặc định
    if (wallets.length === 0) {
      const defaultWallet = await Wallet.create({
        userId,
        name: 'Ví tiền mặt',
        type: 'cash',
        balance: 0,
        currency: 'VND',
      });
      wallets = [defaultWallet];
    }

    return res.json({ success: true, data: wallets });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * GET /api/wallets/default - Lấy ví mặc định đầu tiên
 */
exports.getDefault = async (req, res) => {
  try {
    const userId = req.user.id;
    let wallet = await Wallet.findOne({ userId, isArchived: { $ne: true } }).sort({ createdAt: 1 });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        name: 'Ví tiền mặt',
        type: 'cash',
        balance: 0,
        currency: 'VND',
      });
    }

    return res.json({ success: true, data: wallet });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * POST /api/wallets - Tạo ví mới
 */
exports.create = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, type, balance, currency, accountNumber, bankName } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên ví là bắt buộc.' });
    }

    const wallet = await Wallet.create({
      userId,
      name: name.trim(),
      type: type || 'cash',
      balance: Number(balance) || 0,
      currency: currency || 'VND',
      accountNumber: accountNumber ? accountNumber.trim() : null,
      bankName: bankName ? bankName.trim() : null,
    });

    return res.status(201).json({ success: true, message: 'Tạo ví thành công!', data: wallet });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
