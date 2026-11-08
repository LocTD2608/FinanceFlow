const mongoose = require('mongoose');

jest.mock('../src/models/Wallet', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../src/models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/models/Transaction', () => ({
  create: jest.fn(),
}));

jest.mock('../src/models/P2PTransfer', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../src/utils/dbTransaction', () => ({
  runInTransaction: jest.fn((fn) => fn({})),
}));

jest.mock('../src/services/push.service', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(true),
}));

const Wallet = require('../src/models/Wallet');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const P2PTransfer = require('../src/models/P2PTransfer');
const p2pCtrl = require('../src/controllers/p2p.controller');

const newId = () => new mongoose.Types.ObjectId().toString();
const SENDER_ID = newId();
const RECEIVER_ID = newId();
const SENDER_WALLET_ID = newId();
const RECEIVER_WALLET_ID = newId();
const TARGET_ACC = '1234567890';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (body = {}, query = {}, params = {}) => ({
  user: { id: SENDER_ID },
  body,
  query,
  params,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('P2P Controller', () => {
  describe('lookup', () => {
    test('Số tài khoản không đủ 10 số -> 400', async () => {
      const res = mockRes();
      await p2pCtrl.lookup(mockReq({}, { accountNumber: '123' }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Không tìm thấy ví tương ứng -> 404', async () => {
      Wallet.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      const res = mockRes();
      await p2pCtrl.lookup(mockReq({}, { accountNumber: TARGET_ACC }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('Tìm thấy ví thụ hưởng hợp lệ -> 200', async () => {
      Wallet.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          accountNumber: TARGET_ACC,
          name: 'Ví Techcombank',
          bankName: 'Techcombank',
          type: 'bank',
          userId: { _id: RECEIVER_ID, username: 'Tran Van B', email: 'b@test.com' },
        }),
      });
      const res = mockRes();
      await p2pCtrl.lookup(mockReq({}, { accountNumber: TARGET_ACC }), res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            accountNumber: TARGET_ACC,
            receiverName: 'Tran Van B',
            isSelf: false,
          }),
        })
      );
    });
  });

  describe('transfer', () => {
    test('Thiếu số dư ví gửi -> 400 INSUFFICIENT_BALANCE', async () => {
      Wallet.findOne.mockImplementation(({ _id, accountNumber }) => ({
        session: jest.fn().mockResolvedValue(
          _id
            ? { _id: SENDER_WALLET_ID, userId: SENDER_ID, balance: 50000, type: 'cash' }
            : { _id: RECEIVER_WALLET_ID, userId: RECEIVER_ID, accountNumber: TARGET_ACC }
        ),
      }));

      const res = mockRes();
      await p2pCtrl.transfer(
        mockReq({
          toAccountNumber: TARGET_ACC,
          fromWalletId: SENDER_WALLET_ID,
          amount: 100000,
        }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].code).toBe('INSUFFICIENT_BALANCE');
    });

    test('Tự chuyển cho chính mình -> 400', async () => {
      Wallet.findOne.mockImplementation(({ _id }) => ({
        session: jest.fn().mockResolvedValue(
          _id
            ? { _id: SENDER_WALLET_ID, userId: SENDER_ID, balance: 500000, type: 'cash' }
            : { _id: RECEIVER_WALLET_ID, userId: SENDER_ID, accountNumber: TARGET_ACC } // Cùng userId
        ),
      }));

      const res = mockRes();
      await p2pCtrl.transfer(
        mockReq({
          toAccountNumber: TARGET_ACC,
          fromWalletId: SENDER_WALLET_ID,
          amount: 100000,
        }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toContain('chính mình');
    });

    test('Chuyển tiền thành công: trừ ví gửi, cộng ví nhận, tạo 2 transaction và 1 P2PTransfer -> 201', async () => {
      Wallet.findOne.mockImplementation(({ _id }) => ({
        session: jest.fn().mockResolvedValue(
          _id
            ? { _id: SENDER_WALLET_ID, userId: SENDER_ID, balance: 500000, type: 'cash' }
            : { _id: RECEIVER_WALLET_ID, userId: RECEIVER_ID, accountNumber: TARGET_ACC }
        ),
      }));

      Wallet.findOneAndUpdate.mockResolvedValue({ _id: SENDER_WALLET_ID, balance: 400000 });
      Wallet.findByIdAndUpdate.mockResolvedValue({ _id: RECEIVER_WALLET_ID, balance: 200000 });
      Transaction.create.mockResolvedValue([{}]);
      P2PTransfer.create.mockResolvedValue([
        {
          _id: 'p2p_1',
          senderId: SENDER_ID,
          receiverId: RECEIVER_ID,
          amount: 100000,
          status: 'success',
        },
      ]);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ username: 'Nguyen Van A' }),
      });

      const res = mockRes();
      await p2pCtrl.transfer(
        mockReq({
          toAccountNumber: TARGET_ACC,
          fromWalletId: SENDER_WALLET_ID,
          amount: 100000,
          note: 'Chuyen tien an trua',
        }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(Wallet.findOneAndUpdate).toHaveBeenCalled();
      expect(Wallet.findByIdAndUpdate).toHaveBeenCalled();
      expect(Transaction.create).toHaveBeenCalledTimes(2);
      expect(P2PTransfer.create).toHaveBeenCalledTimes(1);
    });

    test('Idempotency: gửi lại cùng khóa trả về kết quả cũ -> 200 idempotent: true', async () => {
      P2PTransfer.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        then: (cb) =>
          cb({
            _id: 'existing_p2p',
            senderId: SENDER_ID,
            idempotencyKey: 'key_123',
            amount: 50000,
          }),
      });

      const res = mockRes();
      await p2pCtrl.transfer(
        mockReq({
          toAccountNumber: TARGET_ACC,
          fromWalletId: SENDER_WALLET_ID,
          amount: 50000,
          idempotencyKey: 'key_123',
        }),
        res
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotent: true,
          data: expect.objectContaining({ _id: 'existing_p2p' }),
        })
      );
    });
  });
});
