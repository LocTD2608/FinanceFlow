const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const P2PTransfer = require('../models/P2PTransfer');
const pushService = require('../services/push.service');
const realtimeService = require('../services/realtime.service');

const LOCK_TIME_MS = 15 * 60 * 1000; // 15 phút
const MAX_FAILED_ATTEMPTS = 5;
const MIN_AMOUNT = 1000; // 1.000 VND
const MAX_AMOUNT = 10000000; // 10.000.000 VND

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * GET /api/p2p/lookup?query=... (hoặc ?accountNumber=...)
 * Tra cứu thông tin người nhận an toàn (bỏ qua mật khẩu, PIN hash). Chặn tự tra cứu chính mình.
 */
exports.lookupRecipient = async (req, res) => {
  try {
    const rawQuery = req.query.query || req.query.accountNumber;
    if (!rawQuery || typeof rawQuery !== 'string' || !rawQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp thông tin tra cứu (username, email, SĐT hoặc ID).',
      });
    }

    const q = rawQuery.trim();

    // Chặn nhanh nếu query trùng ID người đang đăng nhập
    if (String(req.user.id) === q) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tự chuyển tiền cho chính mình.',
      });
    }

    // Xử lý nếu query là chuỗi JSON từ QR code
    let parsedQrUserId = null;
    if (q.startsWith('{') && q.endsWith('}')) {
      try {
        const parsed = JSON.parse(q);
        if (parsed.userId && isValidId(parsed.userId)) {
          parsedQrUserId = parsed.userId;
        }
      } catch (e) {
        // bỏ qua nếu không phải JSON hợp lệ
      }
    }

    const filter = [];
    if (parsedQrUserId) {
      filter.push({ _id: parsedQrUserId });
    }
    if (isValidId(q)) {
      filter.push({ _id: q });
    }
    filter.push({ username: { $regex: `^${q}$`, $options: 'i' } });
    filter.push({ phone: q });
    filter.push({ email: q.toLowerCase() });
    filter.push({ qrCodePayload: q });

    let recipient = await User.findOne({ $or: filter });

    // Nếu không tìm thấy qua User, thử tìm qua Wallet.accountNumber (hỗ trợ số tài khoản 10 số)
    if (!recipient && /^\d{10}$/.test(q)) {
      const wallet = await Wallet.findOne({ accountNumber: q, isArchived: { $ne: true } }).populate('userId');
      if (wallet && wallet.userId) {
        recipient = wallet.userId;
      }
    }

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người nhận tương ứng.',
      });
    }

    // Chặn tự chuyển tiền cho chính mình
    if (String(recipient._id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tự chuyển tiền cho chính mình.',
      });
    }

    const safeRecipient = {
      id: recipient._id,
      _id: recipient._id,
      username: recipient.username || '',
      nickname: recipient.nickname || recipient.username || 'Người dùng FinanceFlow',
      phone: recipient.phone || '',
      email: recipient.email || '',
      avatar: recipient.avatar || null,
    };

    return res.status(200).json({
      success: true,
      data: safeRecipient,
      recipient: safeRecipient,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// Alias tương thích ngược
exports.lookup = exports.lookupRecipient;

/**
 * POST /api/p2p/transfer
 * Chuyển tiền P2P nguyên tử giữa 2 người dùng kèm bảo mật PIN & số dư
 */
exports.transfer = async (req, res) => {
  try {
    const senderId = req.user.id;
    const {
      recipientId,
      toAccountNumber,
      amount,
      note,
      pin,
      idempotencyKey,
      walletId,
      fromWalletId,
    } = req.body || {};

    // 1. Xác định người nhận
    let targetRecipientId = recipientId;
    if (!targetRecipientId && toAccountNumber && /^\d{10}$/.test(String(toAccountNumber).trim())) {
      const targetWallet = await Wallet.findOne({
        accountNumber: String(toAccountNumber).trim(),
        isArchived: { $ne: true },
      });
      if (targetWallet) {
        targetRecipientId = targetWallet.userId;
      }
    }

    if (!targetRecipientId || !isValidId(targetRecipientId)) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin người nhận không hợp lệ.',
      });
    }

    // Chặn tự chuyển tiền cho chính mình
    if (String(targetRecipientId) === String(senderId)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tự chuyển tiền cho chính mình.',
      });
    }

    // 2. Validate số tiền chuyển
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < MIN_AMOUNT || numericAmount > MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Số tiền chuyển phải từ ${MIN_AMOUNT.toLocaleString('vi-VN')} đ đến ${MAX_AMOUNT.toLocaleString('vi-VN')} đ.`,
      });
    }

    // 3. Kiểm tra thông tin người gửi & mã PIN
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ success: false, message: 'Người gửi không tồn tại.' });
    }

    if (!sender.transactionPinHash) {
      return res.status(400).json({
        success: false,
        code: 'PIN_NOT_SET',
        message: 'Bạn chưa cài đặt mã PIN bảo mật ví.',
      });
    }

    const now = Date.now();
    if (sender.pinLockedUntil && new Date(sender.pinLockedUntil).getTime() > now) {
      const lockRemainingSeconds = Math.max(
        0,
        Math.ceil((new Date(sender.pinLockedUntil).getTime() - now) / 1000)
      );
      return res.status(403).json({
        success: false,
        code: 'PIN_LOCKED',
        message: `Mã PIN đang bị tạm khóa. Vui lòng thử lại sau ${lockRemainingSeconds} giây.`,
        lockRemainingSeconds,
      });
    }

    if (!pin || !/^\d{6}$/.test(String(pin))) {
      return res.status(400).json({
        success: false,
        code: 'PIN_INVALID',
        message: 'Mã PIN phải bao gồm đúng 6 chữ số.',
      });
    }

    const isMatch = await bcrypt.compare(String(pin), sender.transactionPinHash);
    if (!isMatch) {
      sender.failedPinAttempts = (sender.failedPinAttempts || 0) + 1;
      if (sender.failedPinAttempts >= MAX_FAILED_ATTEMPTS) {
        sender.pinLockedUntil = new Date(now + LOCK_TIME_MS);
        await sender.save();
        return res.status(429).json({
          success: false,
          code: 'PIN_LOCKED',
          message: 'Bạn đã nhập sai mã PIN 5 lần liên tiếp. Tài khoản bị tạm khóa 15 phút.',
          lockRemainingSeconds: Math.ceil(LOCK_TIME_MS / 1000),
          attemptsLeft: 0,
        });
      }

      const attemptsLeft = MAX_FAILED_ATTEMPTS - sender.failedPinAttempts;
      await sender.save();
      return res.status(400).json({
        success: false,
        code: 'PIN_INVALID',
        message: `Mã PIN không chính xác. Bạn còn ${attemptsLeft} lần thử.`,
        attemptsLeft,
      });
    }

    // Đúng PIN: Reset số lần thử sai
    sender.failedPinAttempts = 0;
    sender.pinLockedUntil = null;
    await sender.save();

    // 4. Kiểm tra Idempotency chống chuyển trùng lặp
    const cleanIdempotencyKey =
      idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()
        ? idempotencyKey.trim()
        : null;

    if (cleanIdempotencyKey) {
      const existingTx = await Transaction.findOne({
        userId: sender._id,
        idempotencyKey: cleanIdempotencyKey,
      });
      if (existingTx) {
        const sWallet = await Wallet.findById(existingTx.walletId);
        return res.status(200).json({
          success: true,
          message: 'Giao dịch chuyển tiền này đã được thực hiện trước đó.',
          idempotent: true,
          data: {
            transactionId: existingTx._id,
            amount: existingTx.amount,
            recipientName: existingTx.counterpartName,
            newBalance: sWallet ? sWallet.balance : 0,
          },
        });
      }
    }

    // 5. Kiểm tra người nhận
    const recipient = await User.findById(targetRecipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Người nhận không tồn tại.' });
    }

    // 6. Kiểm tra ví người gửi
    const activeWalletId = walletId || fromWalletId;
    let senderWallet;
    if (activeWalletId && isValidId(activeWalletId)) {
      senderWallet = await Wallet.findOne({
        _id: activeWalletId,
        userId: sender._id,
        isArchived: { $ne: true },
      });
    } else {
      const q = Wallet.findOne({
        userId: sender._id,
        isArchived: { $ne: true },
      });
      senderWallet = q && typeof q.sort === 'function' ? await q.sort({ createdAt: 1 }) : await q;
    }

    if (!senderWallet) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy ví thanh toán khả dụng.' });
    }

    if (senderWallet.balance < numericAmount) {
      return res.status(400).json({
        success: false,
        message: `Số dư ví không đủ để thực hiện chuyển tiền. Số dư hiện tại: ${senderWallet.balance.toLocaleString('vi-VN')} đ.`,
      });
    }

    // 7. Lấy hoặc tạo ví người nhận
    const rq = Wallet.findOne({
      userId: recipient._id,
      isArchived: { $ne: true },
    });
    let recipientWallet = rq && typeof rq.sort === 'function' ? await rq.sort({ createdAt: 1 }) : await rq;

    if (!recipientWallet) {
      let accNum = null;
      try {
        const { generateAccountNumber } = require('../utils/accountNumber');
        accNum = await generateAccountNumber();
      } catch (e) {}

      recipientWallet = await Wallet.create({
        userId: recipient._id,
        name: 'Ví tiền mặt',
        type: 'cash',
        balance: 0,
        currency: 'VND',
        ...(accNum ? { accountNumber: accNum } : {}),
      });
    }

    // 8. Thực hiện chuyển tiền nguyên tử
    const updatedSenderWallet = await Wallet.findOneAndUpdate(
      { _id: senderWallet._id, balance: { $gte: numericAmount } },
      { $inc: { balance: -numericAmount } },
      { new: true }
    );

    if (!updatedSenderWallet) {
      return res.status(400).json({
        success: false,
        message: 'Số dư ví không đủ hoặc số dư đã thay đổi.',
      });
    }

    await Wallet.findByIdAndUpdate(recipientWallet._id, { $inc: { balance: numericAmount } }, { new: true });

    const groupId = new mongoose.Types.ObjectId().toString();
    const recipientName =
      recipient.nickname || recipient.username || recipient.email || 'Người dùng FinanceFlow';
    const senderName =
      sender.nickname || sender.username || sender.email || 'Người dùng FinanceFlow';
    const cleanNote = typeof note === 'string' ? note.trim() : '';

    let senderTx;
    let recipientTx;
    try {
      senderTx = await Transaction.create({
        userId: sender._id,
        walletId: senderWallet._id,
        type: 'transfer_out',
        amount: numericAmount,
        counterpartUserId: recipient._id,
        counterpartyUserId: recipient._id,
        counterpartName: recipientName,
        note: cleanNote || `Chuyển tiền đến ${recipientName}`,
        transferNote: cleanNote,
        groupId,
        source: 'p2p',
        transactionDate: new Date(),
        ...(cleanIdempotencyKey ? { idempotencyKey: cleanIdempotencyKey } : {}),
      });

      recipientTx = await Transaction.create({
        userId: recipient._id,
        walletId: recipientWallet._id,
        type: 'transfer_in',
        amount: numericAmount,
        counterpartUserId: sender._id,
        counterpartyUserId: sender._id,
        counterpartName: senderName,
        note: cleanNote || `Nhận tiền từ ${senderName}`,
        transferNote: cleanNote,
        groupId,
        source: 'p2p',
        transactionDate: new Date(),
      });

      // Tạo P2PTransfer record
      await P2PTransfer.create({
        senderId: sender._id,
        receiverId: recipient._id,
        senderWalletId: senderWallet._id,
        receiverWalletId: recipientWallet._id,
        amount: numericAmount,
        note: cleanNote,
        status: 'success',
        groupId,
        ...(cleanIdempotencyKey ? { idempotencyKey: cleanIdempotencyKey } : {}),
      }).catch(() => {});
    } catch (txErr) {
      // Hoàn tác số dư nếu tạo giao dịch thất bại
      await Wallet.findByIdAndUpdate(senderWallet._id, { $inc: { balance: numericAmount } });
      await Wallet.findByIdAndUpdate(recipientWallet._id, { $inc: { balance: -numericAmount } });
      throw txErr;
    }

    // 9. Gửi push notification cho người nhận
    try {
      await pushService.sendToUser(recipient._id, {
        title: 'Tiền vào ví! 💰',
        body: `Bạn vừa nhận được ${numericAmount.toLocaleString('vi-VN')} đ từ ${senderName}.`,
        data: {
          type: 'p2p_transfer',
          transactionId: recipientTx ? recipientTx._id.toString() : '',
          amount: numericAmount,
          senderName,
          note: cleanNote,
        },
      });
    } catch (pushErr) {
      console.error('[p2p] Gửi push notification lỗi:', pushErr.message);
    }

    // 9.1 Phát sự kiện biến động số dư Realtime qua Socket.io
    try {
      realtimeService.emitBalanceChange(recipient._id.toString(), {
        type: 'transfer',
        direction: 'in',
        amount: numericAmount,
        walletId: recipientWallet._id.toString(),
        walletName: recipientWallet.name,
        newBalance: updatedRecipientWallet.balance,
        note: `Nhận tiền từ ${senderName}${cleanNote ? ': ' + cleanNote : ''}`,
      });
      realtimeService.emitBalanceChange(sender._id.toString(), {
        type: 'transfer',
        direction: 'out',
        amount: numericAmount,
        walletId: senderWallet._id.toString(),
        walletName: senderWallet.name,
        newBalance: updatedSenderWallet.balance,
        note: `Chuyển tiền đến ${recipientName}${cleanNote ? ': ' + cleanNote : ''}`,
      });
    } catch (realtimeErr) {
      // ignore
    }

    // 10. Trả về kết quả
    return res.status(200).json({
      success: true,
      message: 'Chuyển tiền thành công!',
      data: {
        transactionId: senderTx._id,
        amount: numericAmount,
        recipientName,
        newBalance: updatedSenderWallet.balance,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * GET /api/p2p/transfers
 * Lịch sử giao dịch P2P của người dùng
 */
exports.listTransfers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { direction = 'all', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let filter = {};
    if (direction === 'out') {
      filter = { userId, type: 'transfer_out' };
    } else if (direction === 'in') {
      filter = { userId, type: 'transfer_in' };
    } else {
      filter = { userId, type: { $in: ['transfer_out', 'transfer_in'] } };
    }

    const [transfers, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('counterpartUserId', 'username nickname avatar email phone')
        .populate('walletId', 'name type accountNumber')
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        transfers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * GET /api/p2p/transfers/:id
 * Chi tiết giao dịch P2P
 */
exports.getTransferById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ.' });
    }

    const transfer = await Transaction.findOne({
      _id: id,
      userId,
      type: { $in: ['transfer_out', 'transfer_in'] },
    })
      .populate('counterpartUserId', 'username nickname avatar email phone')
      .populate('walletId', 'name type accountNumber');

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin giao dịch.' });
    }

    return res.json({ success: true, data: transfer });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
