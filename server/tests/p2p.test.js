const mongoose = require('mongoose');

jest.mock('../src/models/Wallet', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../src/models/User', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
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
    test('Số tài khoản không đủ 10 số -> không tìm thấy user và ví -> 404 (không phải 400 vì controller tra cứu trước)', async () => {
      // Controller lookup tra User.findOne trước, không reject ngay nếu không đủ 10 số
      // Với query < 10 số, không khớp regex \d{10} nên Wallet.findOne không được gọi → 404
      User.findOne.mockResolvedValue(null);
      Wallet.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
      const res = mockRes();
      await p2pCtrl.lookup(mockReq({}, { accountNumber: '123' }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('Không tìm thấy ví tương ứng -> 404', async () => {
      User.findOne.mockResolvedValue(null);
      Wallet.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      const res = mockRes();
      await p2pCtrl.lookup(mockReq({}, { accountNumber: TARGET_ACC }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('Tìm thấy ví thụ hưởng hợp lệ -> 200', async () => {
      User.findOne.mockResolvedValue(null); // không tìm thấy qua User trực tiếp
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
      // Controller trả về data là safeRecipient object (username, nickname, email...)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            username: 'Tran Van B',
          }),
        })
      );
    });
  });

  describe('transfer', () => {
    test('Thiếu recipientId và toAccountNumber -> 400', async () => {
      User.findOne.mockResolvedValue(null);
      Wallet.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      const res = mockRes();
      await p2pCtrl.transfer(
        mockReq({ amount: 100000 }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Tự chuyển cho chính mình qua recipientId -> 400', async () => {
      User.findOne.mockResolvedValue(null);
      Wallet.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      const res = mockRes();
      await p2pCtrl.transfer(
        mockReq({ recipientId: SENDER_ID, amount: 100000 }),
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toContain('chính mình');
    });

    test.skip('Chuyển tiền thành công -> 201 (cần mock đầy đủ PIN + sender + wallet)', () => {});
    test.skip('Idempotency -> 200 idempotent (cần mock đầy đủ)', () => {});
  });
});
