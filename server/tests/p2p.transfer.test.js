const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Mock User and Auth
const SENDER_ID = new mongoose.Types.ObjectId().toString();
const RECIPIENT_ID = new mongoose.Types.ObjectId().toString();
const SENDER_WALLET_ID = new mongoose.Types.ObjectId().toString();
const RECIPIENT_WALLET_ID = new mongoose.Types.ObjectId().toString();

const mockUserHolder = {
  currentUserId: SENDER_ID,
  currentUserEmail: 'sender@financeflow.vn',
};

jest.mock('../src/middleware/auth', () => (req, res, next) => {
  req.user = {
    id: mockUserHolder.currentUserId,
    _id: mockUserHolder.currentUserId,
    email: mockUserHolder.currentUserEmail,
    role: 'user',
    status: 'active',
  };
  next();
});

// Mock Push Service
jest.mock('../src/services/push.service', () => ({
  sendToUser: jest.fn().mockResolvedValue(1),
}));

// Mock Models
jest.mock('../src/models/User');
jest.mock('../src/models/Wallet');
jest.mock('../src/models/Transaction');
jest.mock('../src/models/P2PTransfer');

const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');
const Transaction = require('../src/models/Transaction');
const P2PTransfer = require('../src/models/P2PTransfer');
const pushService = require('../src/services/push.service');
const realtimeService = require('../src/services/realtime.service');
jest.spyOn(realtimeService, 'emitBalanceChange');
const p2pRoutes = require('../src/routes/p2p.routes');

const app = express();
app.use(express.json());
app.use('/api/p2p', p2pRoutes);

describe('P2P Transfer & Recipient Lookup API', () => {
  let senderUser;
  let recipientUser;
  let senderWallet;
  let recipientWallet;
  const validPin = '123456';
  let pinHash;

  beforeAll(async () => {
    pinHash = await bcrypt.hash(validPin, 8);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserHolder.currentUserId = SENDER_ID;
    mockUserHolder.currentUserEmail = 'sender@financeflow.vn';

    senderUser = {
      _id: SENDER_ID,
      id: SENDER_ID,
      username: 'sender_user',
      nickname: 'Người Gửi',
      email: 'sender@financeflow.vn',
      phone: '0901234567',
      avatar: 'https://example.com/sender.png',
      transactionPinHash: pinHash,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      save: jest.fn().mockResolvedValue(true),
    };

    recipientUser = {
      _id: RECIPIENT_ID,
      id: RECIPIENT_ID,
      username: 'recipient_user',
      nickname: 'Người Nhận',
      email: 'recipient@financeflow.vn',
      phone: '0987654321',
      avatar: 'https://example.com/recipient.png',
      transactionPinHash: pinHash,
      save: jest.fn().mockResolvedValue(true),
    };

    senderWallet = {
      _id: SENDER_WALLET_ID,
      userId: SENDER_ID,
      name: 'Ví tiền mặt',
      type: 'cash',
      balance: 1000000,
      currency: 'VND',
      accountNumber: '1234567890',
      save: jest.fn().mockResolvedValue(true),
    };

    recipientWallet = {
      _id: RECIPIENT_WALLET_ID,
      userId: RECIPIENT_ID,
      name: 'Ví tiền mặt',
      type: 'cash',
      balance: 200000,
      currency: 'VND',
      accountNumber: '0987654321',
      save: jest.fn().mockResolvedValue(true),
    };
  });

  // ==========================================
  // 1. GET /api/p2p/lookup
  // ==========================================
  describe('GET /api/p2p/lookup', () => {
    it('tra cứu thành công theo username / phone / id và trả về thông tin an toàn', async () => {
      User.findOne = jest.fn().mockResolvedValue(recipientUser);

      const res = await request(app)
        .get('/api/p2p/lookup')
        .query({ query: 'recipient_user' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const recipientData = res.body.data || res.body.recipient;
      expect(recipientData).toBeDefined();
      expect(recipientData.username).toBe('recipient_user');
      expect(recipientData.nickname).toBe('Người Nhận');
      expect(recipientData.phone).toBe('0987654321');
      expect(recipientData.email).toBe('recipient@financeflow.vn');
      // Không lộ passwordHash hay pinHash
      expect(recipientData.passwordHash).toBeUndefined();
      expect(recipientData.transactionPinHash).toBeUndefined();
    });

    it('từ chối khi tự tra cứu chính mình -> 400', async () => {
      User.findOne = jest.fn().mockResolvedValue(senderUser);

      const res = await request(app)
        .get('/api/p2p/lookup')
        .query({ query: SENDER_ID });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Không thể tự chuyển tiền cho chính mình/i);
    });

    it('trả về 404 khi không tìm thấy người nhận', async () => {
      User.findOne = jest.fn().mockResolvedValue(null);

      const res = await request(app)
        .get('/api/p2p/lookup')
        .query({ query: 'non_existing_user' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('trả về 400 khi thiếu tham số query', async () => {
      const res = await request(app).get('/api/p2p/lookup');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 2. POST /api/p2p/transfer
  // ==========================================
  describe('POST /api/p2p/transfer', () => {
    beforeEach(() => {
      User.findById = jest.fn().mockImplementation((id) => {
        if (String(id) === String(SENDER_ID)) return Promise.resolve(senderUser);
        if (String(id) === String(RECIPIENT_ID)) return Promise.resolve(recipientUser);
        return Promise.resolve(null);
      });

      Wallet.findOne = jest.fn().mockImplementation((query) => {
        const userIdStr = String(query.userId);
        if (userIdStr === String(SENDER_ID)) return Promise.resolve(senderWallet);
        if (userIdStr === String(RECIPIENT_ID)) return Promise.resolve(recipientWallet);
        return Promise.resolve(null);
      });

      Wallet.findById = jest.fn().mockImplementation((id) => {
        if (String(id) === String(SENDER_WALLET_ID)) return Promise.resolve(senderWallet);
        if (String(id) === String(RECIPIENT_WALLET_ID)) return Promise.resolve(recipientWallet);
        return Promise.resolve(null);
      });

      Wallet.findOneAndUpdate = jest.fn().mockImplementation((query, update) => {
        const idStr = String(query._id);
        const inc = update.$inc && update.$inc.balance ? update.$inc.balance : 0;
        if (idStr === String(SENDER_WALLET_ID)) {
          if (query['balance'] && query['balance'].$gte && senderWallet.balance < query['balance'].$gte) {
            return Promise.resolve(null);
          }
          senderWallet.balance += inc;
          return Promise.resolve(senderWallet);
        }
        return Promise.resolve(null);
      });

      Wallet.findByIdAndUpdate = jest.fn().mockImplementation((id, update) => {
        const idStr = String(id);
        const inc = update.$inc && update.$inc.balance ? update.$inc.balance : 0;
        if (idStr === String(RECIPIENT_WALLET_ID)) {
          recipientWallet.balance += inc;
          return Promise.resolve(recipientWallet);
        }
        if (idStr === String(SENDER_WALLET_ID)) {
          senderWallet.balance += inc;
          return Promise.resolve(senderWallet);
        }
        return Promise.resolve(null);
      });

      Transaction.create = jest.fn().mockImplementation((data) =>
        Promise.resolve({
          _id: new mongoose.Types.ObjectId().toString(),
          ...data,
        })
      );

      Transaction.findOne = jest.fn().mockResolvedValue(null);
      P2PTransfer.create = jest.fn().mockResolvedValue({ _id: 'transfer_123' });
    });

    it('chuyển tiền thành công: trừ tiền người gửi, cộng tiền người nhận, tạo 2 Transaction, gửi push notification', async () => {
      const transferAmount = 250000;
      const note = 'Cà phê sáng';

      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: transferAmount,
        note,
        pin: validPin,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.amount).toBe(transferAmount);
      expect(res.body.data.newBalance).toBe(1000000 - transferAmount);

      // Kiểm tra biến động số dư ví
      expect(senderWallet.balance).toBe(750000);
      expect(recipientWallet.balance).toBe(450000);

      // Kiểm tra 2 Transaction được tạo
      expect(Transaction.create).toHaveBeenCalledTimes(2);
      const firstCallArg = Transaction.create.mock.calls[0][0];
      const secondCallArg = Transaction.create.mock.calls[1][0];

      // 1 transfer_out cho người gửi
      expect(firstCallArg).toMatchObject({
        userId: SENDER_ID,
        type: 'transfer_out',
        amount: transferAmount,
        counterpartUserId: RECIPIENT_ID,
      });

      // 1 transfer_in cho người nhận
      expect(secondCallArg).toMatchObject({
        userId: RECIPIENT_ID,
        type: 'transfer_in',
        amount: transferAmount,
        counterpartUserId: SENDER_ID,
      });

      // Kiểm tra push notification gửi đến người nhận
      expect(pushService.sendToUser).toHaveBeenCalledWith(
        RECIPIENT_ID,
        expect.objectContaining({
          title: expect.any(String),
          body: expect.stringContaining('250.000'),
        })
      );

      // Kiểm tra phát sự kiện biến động số dư Realtime Ting Ting cho cả 2 bên
      expect(realtimeService.emitBalanceChange).toHaveBeenCalledWith(
        RECIPIENT_ID,
        expect.objectContaining({
          direction: 'in',
          amount: transferAmount,
          newBalance: 450000,
        })
      );
      expect(realtimeService.emitBalanceChange).toHaveBeenCalledWith(
        SENDER_ID,
        expect.objectContaining({
          direction: 'out',
          amount: transferAmount,
          newBalance: 750000,
        })
      );
    });

    it('từ chối khi tự chuyển tiền cho chính mình -> 400', async () => {
      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: SENDER_ID,
        amount: 50000,
        pin: validPin,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/chính mình/i);
    });

    it('từ chối khi số dư không đủ -> 400', async () => {
      senderWallet.balance = 10000;

      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: 500000,
        pin: validPin,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/số dư.*không đủ/i);
      expect(Transaction.create).not.toHaveBeenCalled();
    });

    it('từ chối khi số tiền nhỏ hơn 1.000 VND -> 400', async () => {
      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: 500,
        pin: validPin,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('từ chối khi số tiền vượt quá 10.000.000 VND -> 400', async () => {
      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: 10000001,
        pin: validPin,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('từ chối khi người gửi chưa cài đặt mã PIN -> 400 PIN_NOT_SET', async () => {
      senderUser.transactionPinHash = null;

      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: 50000,
        pin: validPin,
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PIN_NOT_SET');
    });

    it('từ chối khi tài khoản đang bị khóa mã PIN -> 403 PIN_LOCKED', async () => {
      senderUser.pinLockedUntil = new Date(Date.now() + 10 * 60 * 1000); // Còn 10 phút khóa

      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: 50000,
        pin: validPin,
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PIN_LOCKED');
      expect(res.body.lockRemainingSeconds).toBeGreaterThan(0);
    });

    it('từ chối khi nhập sai mã PIN -> tăng failedPinAttempts và trả về 400', async () => {
      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: 50000,
        pin: '999999', // sai PIN
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PIN_INVALID');
      expect(senderUser.failedPinAttempts).toBe(1);
      expect(senderUser.save).toHaveBeenCalled();
    });

    it('khóa tài khoản khi nhập sai mã PIN 5 lần liên tiếp -> 429 hoặc 403 PIN_LOCKED', async () => {
      senderUser.failedPinAttempts = 4;

      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: 50000,
        pin: '999999',
      });

      expect([403, 429]).toContain(res.status);
      expect(res.body.code).toBe('PIN_LOCKED');
      expect(senderUser.failedPinAttempts).toBe(5);
      expect(senderUser.pinLockedUntil).toBeDefined();
    });

    it('idempotencyKey ngăn chặn việc trừ tiền 2 lần khi gửi lại request', async () => {
      const existingTx = {
        _id: 'tx_existing_123',
        userId: SENDER_ID,
        walletId: SENDER_WALLET_ID,
        type: 'transfer_out',
        amount: 150000,
        counterpartName: 'Người Nhận',
        idempotencyKey: 'idemp-12345',
      };

      Transaction.findOne = jest.fn().mockImplementation((query) => {
        if (query.idempotencyKey === 'idemp-12345') {
          return Promise.resolve(existingTx);
        }
        return Promise.resolve(null);
      });

      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: 150000,
        pin: validPin,
        idempotencyKey: 'idemp-12345',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.idempotent).toBe(true);
      expect(res.body.data.transactionId).toBe('tx_existing_123');

      // Không trừ thêm tiền ví
      expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Transaction.create).not.toHaveBeenCalled();
    });

    it('chuyển tiền vẫn thành công khi push notification gặp lỗi', async () => {
      pushService.sendToUser.mockRejectedValueOnce(new Error('Push notification failure'));

      const res = await request(app).post('/api/p2p/transfer').send({
        recipientId: RECIPIENT_ID,
        amount: 50000,
        pin: validPin,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(senderWallet.balance).toBe(950000);
    });
  });
});
