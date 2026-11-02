const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const P2PTransfer = require('../models/P2PTransfer');
const { runInTransaction } = require('../utils/dbTransaction');
const { insufficientBody } = require('../utils/walletBalance');
const pushService = require('../services/push.service');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const P2P_MAX_AMOUNT = 50000000; // 50.000.000 VND

/**
 * GET /api/p2p/lookup?accountNumber=
 * Tra cứu thông tin người nhận theo số tài khoản 10 chữ số
 */
exports.lookup = async (req, res) => {
  try {
    const { accountNumber } = req.query;
    if (!accountNumber || !/^\d{10}$/.test(String(accountNumber).trim())) {
      return fail(res, 400, 'Số tài khoản phải gồm đúng 10 chữ số.');
    }

    const accStr = String(accountNumber).trim();
    const wallet = await Wallet.findOne({
      accountNumber: accStr,
      isArchived: { $ne: true },
    }).populate('userId', 'username email avatar');

    if (!wallet || !wallet.userId) {
      return fail(res, 404, 'Không tìm thấy tài khoản thụ hưởng tương ứng với số tài khoản này.');
    }

    const isSelf = String(wallet.userId._id) === String(req.user.id);

    return res.json({
      success: true,
      data: {
        accountNumber: wallet.accountNumber,
        walletName: wallet.name,
        walletType: wallet.type,
        bankName: wallet.bankName,
        receiverId: wallet.userId._id,
        receiverName: wallet.userId.username || 'Người dùng FinanceFlow',
        receiverEmail: wallet.userId.email ? wallet.userId.email.replace(/(.{2})(.*)(?=@)/, '$1***') : null,
        isSelf,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * POST /api/p2p/transfers
 * Chuyển tiền P2P giữa hai người dùng (chạy trong transaction)
 */
exports.transfer = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { toAccountNumber, fromWalletId, amount, note, idempotencyKey } = req.body;

    // 1. Validate tham số đầu vào
    if (!toAccountNumber || !/^\d{10}$/.test(String(toAccountNumber).trim())) {
      return fail(res, 400, 'Số tài khoản người nhận phải gồm đúng 10 chữ số.');
    }
    const targetAcc = String(toAccountNumber).trim();

    if (!fromWalletId || !isValidId(fromWalletId)) {
      return fail(res, 400, 'ID ví chuyển tiền không hợp lệ.');
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return fail(res, 400, 'Số tiền chuyển phải lớn hơn 0.');
    }
    if (numericAmount > P2P_MAX_AMOUNT) {
      return fail(res, 400, `Số tiền chuyển tối đa mỗi lần là ${P2P_MAX_AMOUNT.toLocaleString('vi-VN')} đ.`);
    }

    // 2. Kiểm tra Idempotency chống chuyển trùng khi mạng chập chờn
    if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
      const existingTransfer = await P2PTransfer.findOne({
        senderId,
        idempotencyKey: idempotencyKey.trim(),
      })
        .populate('receiverId', 'username email')
        .populate('senderWalletId', 'name accountNumber')
        .populate('receiverWalletId', 'name accountNumber');

      if (existingTransfer) {
        return res.json({
          success: true,
          message: 'Giao dịch chuyển tiền này đã được thực hiện trước đó.',
          idempotent: true,
          data: existingTransfer,
        });
      }
    }

    // 3. Thực thi chuyển tiền trong Transaction
    const transferResult = await runInTransaction(async (session) => {
      // a. Kiểm tra ví gửi
      const senderWallet = await Wallet.findOne({
        _id: fromWalletId,
        userId: senderId,
        isArchived: { $ne: true },
      }).session(session);

      if (!senderWallet) {
        const err = new Error('Ví gửi không tồn tại hoặc bạn không có quyền truy cập.');
        err.status = 404;
        throw err;
      }

      if (senderWallet.type !== 'credit_card' && senderWallet.balance < numericAmount) {
        const err = new Error('Số dư trong ví không đủ để thực hiện chuyển tiền.');
        err.status = 400;
        err.body = insufficientBody(senderWallet.balance, numericAmount);
        throw err;
      }

      // b. Kiểm tra ví nhận
      const receiverWallet = await Wallet.findOne({
        accountNumber: targetAcc,
        isArchived: { $ne: true },
      }).session(session);

      if (!receiverWallet) {
        const err = new Error('Số tài khoản thụ hưởng không tồn tại.');
        err.status = 404;
        throw err;
      }

      if (String(receiverWallet.userId) === String(senderId)) {
        const err = new Error(
          'Không thể tự chuyển tiền P2P cho chính mình. Hãy dùng tính năng chuyển giữa các ví cá nhân.'
        );
        err.status = 400;
        throw err;
      }

      // c. Trừ tiền ví gửi có điều kiện số dư
      const deducted = await Wallet.findOneAndUpdate(
        {
          _id: senderWallet._id,
          $or: [{ type: 'credit_card' }, { balance: { $gte: numericAmount } }],
        },
        { $inc: { balance: -numericAmount } },
        { session, new: true }
      );

      if (!deducted) {
        const err = new Error('Số dư ví không đủ.');
        err.status = 400;
        err.body = insufficientBody(senderWallet.balance, numericAmount);
        throw err;
      }

      // d. Cộng tiền ví nhận
      await Wallet.findByIdAndUpdate(
        receiverWallet._id,
        { $inc: { balance: numericAmount } },
        { session, new: true }
      );

      // e. Tạo 2 Transaction (p2p_out và p2p_in) chung groupId
      const groupId = 'p2p_' + new mongoose.Types.ObjectId().toString();

      await Transaction.create(
        [
          {
            userId: senderId,
            walletId: senderWallet._id,
            amount: numericAmount,
            type: 'p2p_out',
            counterpartyUserId: receiverWallet.userId,
            groupId,
            source: 'p2p',
            note: note ? note.trim() : `Chuyển tiền P2P tới STK ${targetAcc}`,
            transactionDate: new Date(),
          },
        ],
        { session }
      );

      await Transaction.create(
        [
          {
            userId: receiverWallet.userId,
            walletId: receiverWallet._id,
            amount: numericAmount,
            type: 'p2p_in',
            counterpartyUserId: senderId,
            groupId,
            source: 'p2p',
            note: note ? note.trim() : `Nhận tiền P2P từ STK ${senderWallet.accountNumber || 'nội bộ'}`,
            transactionDate: new Date(),
          },
        ],
        { session }
      );

      // f. Tạo bản ghi P2PTransfer
      const [p2pDoc] = await P2PTransfer.create(
        [
          {
            senderId,
            receiverId: receiverWallet.userId,
            senderWalletId: senderWallet._id,
            receiverWalletId: receiverWallet._id,
            amount: numericAmount,
            note: note ? note.trim() : '',
            status: 'success',
            groupId,
            idempotencyKey: idempotencyKey ? idempotencyKey.trim() : null,
          },
        ],
        { session }
      );

      return {
        transfer: p2pDoc,
        receiverUserId: receiverWallet.userId,
        senderWallet,
      };
    });

    // 4. Bắn push notification cho người nhận (nếu có cấu hình) sau khi commit thành công
    try {
      if (pushService && typeof pushService.sendPushToUser === 'function') {
        const senderUser = await User.findById(senderId).select('username');
        const senderName = senderUser?.username || 'Một người dùng';
        await pushService.sendPushToUser(transferResult.receiverUserId, {
          title: 'Biến động số dư +',
          body: `Bạn vừa nhận được ${numericAmount.toLocaleString('vi-VN')} đ từ ${senderName}.`,
          data: { type: 'p2p_received', transferId: transferResult.transfer._id },
        });
      }
    } catch {
      // Push notification không được làm gián đoạn response thành công
    }

    return res.status(201).json({
      success: true,
      message: 'Chuyển tiền thành công!',
      data: transferResult.transfer,
    });
  } catch (error) {
    if (error.body) {
      return res.status(error.status || 400).json(error.body);
    }
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/p2p/transfers?direction=in|out|all&page=1&limit=20
 * Lịch sử chuyển nhận tiền P2P
 */
exports.listTransfers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { direction = 'all', page = 1, limit = 20 } = req.query;

    const filter = {};
    if (direction === 'out') {
      filter.senderId = userId;
    } else if (direction === 'in') {
      filter.receiverId = userId;
    } else {
      filter.$or = [{ senderId: userId }, { receiverId: userId }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const total = await P2PTransfer.countDocuments(filter);
    const transfers = await P2PTransfer.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('senderId', 'username email avatar')
      .populate('receiverId', 'username email avatar')
      .populate('senderWalletId', 'name accountNumber bankName type')
      .populate('receiverWalletId', 'name accountNumber bankName type')
      .lean();

    return res.json({
      success: true,
      data: transfers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * GET /api/p2p/transfers/:id
 * Chi tiết một giao dịch P2P
 */
exports.getTransferById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 400, 'ID giao dịch không hợp lệ.');

    const transfer = await P2PTransfer.findOne({
      _id: id,
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate('senderId', 'username email avatar')
      .populate('receiverId', 'username email avatar')
      .populate('senderWalletId', 'name accountNumber bankName type')
      .populate('receiverWalletId', 'name accountNumber bankName type')
      .lean();

    if (!transfer) return fail(res, 404, 'Không tìm thấy giao dịch chuyển tiền.');

    return res.json({ success: true, data: transfer });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
