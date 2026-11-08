const mongoose = require('mongoose');

jest.mock('../src/models/Goal', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../src/models/GoalContribution', () => ({
  find: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../src/models/Wallet', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../src/models/Transaction', () => ({
  create: jest.fn(),
}));

jest.mock('../src/models/Category', () => ({
  findOne: jest.fn(),
}));

jest.mock('../src/utils/dbTransaction', () => ({
  runInTransaction: jest.fn((fn) => fn({})),
}));

const Goal = require('../src/models/Goal');
const GoalContribution = require('../src/models/GoalContribution');
const Wallet = require('../src/models/Wallet');
const Transaction = require('../src/models/Transaction');
const Category = require('../src/models/Category');
const goalCtrl = require('../src/controllers/goal.controller');

const newId = () => new mongoose.Types.ObjectId().toString();
const USER_ID = newId();
const GOAL_ID = newId();
const WALLET_ID = newId();

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (body = {}, params = { id: GOAL_ID }, query = {}) => ({
  user: { id: USER_ID },
  body,
  params,
  query,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Goal Controller', () => {
  describe('create & list', () => {
    test('tạo mục tiêu thành công -> 201', async () => {
      Goal.create.mockResolvedValue({
        _id: GOAL_ID,
        name: 'Mua xe máy',
        targetAmount: 30000000,
        currentAmount: 0,
        status: 'active',
      });

      const res = mockRes();
      await goalCtrl.create(
        mockReq({ name: 'Mua xe máy', targetAmount: 30000000 }),
        res
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(Goal.create).toHaveBeenCalled();
    });

    test('danh sách tính đúng progressPercent, remaining, daysLeft', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000 * 5);
      Goal.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: GOAL_ID,
            name: 'Laptop mới',
            targetAmount: 20000000,
            currentAmount: 10000000,
            status: 'active',
            deadline: tomorrow,
          },
        ]),
      });

      const res = mockRes();
      await goalCtrl.list(mockReq(), res);

      const data = res.json.mock.calls[0][0].data;
      expect(data).toHaveLength(1);
      expect(data[0].progressPercent).toBe(50);
      expect(data[0].remaining).toBe(10000000);
      expect(data[0].daysLeft).toBeGreaterThanOrEqual(4);
    });
  });

  describe('contribute (tiết kiệm)', () => {
    test('số dư ví không đủ -> 400 INSUFFICIENT_BALANCE', async () => {
      Goal.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({
          _id: GOAL_ID,
          userId: USER_ID,
          name: 'Laptop',
          status: 'active',
          targetAmount: 20000000,
          currentAmount: 0,
        }),
      });

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({
          _id: WALLET_ID,
          userId: USER_ID,
          balance: 50000,
          type: 'cash',
        }),
      });

      const res = mockRes();
      await goalCtrl.contribute(mockReq({ amount: 500000, walletId: WALLET_ID }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].code).toBe('INSUFFICIENT_BALANCE');
    });

    test('đóng góp chưa chạm đích: trừ ví, tạo expense Tiết kiệm, cập nhật currentAmount', async () => {
      const mockGoalDoc = {
        _id: GOAL_ID,
        userId: USER_ID,
        name: 'Laptop',
        status: 'active',
        targetAmount: 20000000,
        currentAmount: 5000000,
        save: jest.fn().mockResolvedValue(true),
      };

      Goal.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockGoalDoc),
      });

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({
          _id: WALLET_ID,
          userId: USER_ID,
          balance: 2000000,
          type: 'cash',
        }),
      });

      Wallet.findOneAndUpdate.mockResolvedValue({ _id: WALLET_ID, balance: 1000000 });
      Category.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({ _id: 'cat_saving', name: 'Tiết kiệm' }),
      });
      Transaction.create.mockResolvedValue([{ _id: 'tx_expense' }]);
      GoalContribution.create.mockResolvedValue([{}]);

      const res = mockRes();
      await goalCtrl.contribute(mockReq({ amount: 1000000, walletId: WALLET_ID }), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(Wallet.findOneAndUpdate).toHaveBeenCalled();
      expect(mockGoalDoc.currentAmount).toBe(6000000);
      expect(mockGoalDoc.status).toBe('active');
      expect(mockGoalDoc.save).toHaveBeenCalled();
    });

    test('đóng góp đạt mốc: chuyển completed và tự động hoàn trả 100% tiền về ví', async () => {
      const mockGoalDoc = {
        _id: GOAL_ID,
        userId: USER_ID,
        name: 'Laptop',
        status: 'active',
        targetAmount: 10000000,
        currentAmount: 9000000,
        targetWalletId: WALLET_ID,
        save: jest.fn().mockResolvedValue(true),
      };

      Goal.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockGoalDoc),
      });

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({
          _id: WALLET_ID,
          userId: USER_ID,
          balance: 2000000,
          type: 'cash',
        }),
      });

      Wallet.findOneAndUpdate.mockResolvedValue({ _id: WALLET_ID, balance: 1000000 });
      Wallet.findByIdAndUpdate.mockResolvedValue({ _id: WALLET_ID, balance: 11000000 });
      Category.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({ _id: 'cat_income', name: 'Khác (Thu)' }),
      });
      Transaction.create.mockResolvedValue([{ _id: 'tx_1' }]);
      GoalContribution.create.mockResolvedValue([{}]);

      const res = mockRes();
      await goalCtrl.contribute(mockReq({ amount: 1000000, walletId: WALLET_ID }), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockGoalDoc.status).toBe('completed');
      expect(mockGoalDoc.currentAmount).toBe(10000000);
      expect(mockGoalDoc.completedAt).toBeInstanceOf(Date);
      expect(mockGoalDoc.refundAmount).toBe(10000000);

      // Đã gọi hoàn trả 100% tiền về ví
      expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
        WALLET_ID,
        { $inc: { balance: 10000000 } },
        expect.anything()
      );
      // Đã tạo 2 transaction: 1 expense lúc nạp tiết kiệm, 1 income lúc hoàn trả hoàn thành
      expect(Transaction.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancel (hủy mục tiêu)', () => {
    test('hủy mục tiêu có 10.000.000 đ: phạt 5% (500.000 đ), hoàn trả 95% (9.500.000 đ) về ví', async () => {
      const mockGoalDoc = {
        _id: GOAL_ID,
        userId: USER_ID,
        name: 'Du lịch Nhật',
        status: 'active',
        targetAmount: 30000000,
        currentAmount: 10000000,
        targetWalletId: WALLET_ID,
        save: jest.fn().mockResolvedValue(true),
      };

      Goal.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockGoalDoc),
      });

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({
          _id: WALLET_ID,
          userId: USER_ID,
          balance: 1000000,
        }),
      });

      Wallet.findByIdAndUpdate.mockResolvedValue({ _id: WALLET_ID, balance: 10500000 });
      Category.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue({ _id: 'cat_income', name: 'Khác (Thu)' }),
      });
      Transaction.create.mockResolvedValue([{ _id: 'tx_refund' }]);

      const res = mockRes();
      await goalCtrl.cancel(mockReq({}, { id: GOAL_ID }), res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            penaltyFee: 500000, // 5% của 10tr
            refundAmount: 9500000, // 95% của 10tr
          }),
        })
      );

      // Đã cộng 9.500.000 vào ví
      expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
        WALLET_ID,
        { $inc: { balance: 9500000 } },
        expect.anything()
      );
      expect(mockGoalDoc.status).toBe('cancelled');
      expect(mockGoalDoc.penaltyFee).toBe(500000);
      expect(mockGoalDoc.refundAmount).toBe(9500000);
    });
  });
});
