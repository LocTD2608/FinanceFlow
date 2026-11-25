const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

jest.mock('../src/services/push.service', () => ({
  sendToUser: jest.fn().mockResolvedValue(1),
}));

jest.mock('../src/services/realtime.service', () => ({
  emitBalanceChange: jest.fn(),
  emitFinancialAlert: jest.fn(),
}));

const pushService = require('../src/services/push.service');
const realtimeService = require('../src/services/realtime.service');
const Goal = require('../src/models/Goal');
const GoalContribution = require('../src/models/GoalContribution');
const Wallet = require('../src/models/Wallet');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const goalController = require('../src/controllers/goal.controller');

jest.setTimeout(180000);

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

let mongo;
let uid;
let sourceWallet;
let targetWallet;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: '7.0.14' },
  });
  await mongoose.connect(mongo.getUri(), { dbName: 'kan71_test' });
  await Promise.all([Goal, GoalContribution, Wallet, Category, Transaction].map((m) => m.init()));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([Goal, GoalContribution, Wallet, Category, Transaction].map((m) => m.deleteMany({})));
  jest.clearAllMocks();
  pushService.sendToUser.mockResolvedValue(1);

  uid = new mongoose.Types.ObjectId();
  sourceWallet = await Wallet.create({
    userId: uid,
    name: 'Ví chi tiêu',
    type: 'cash',
    balance: 2000000,
    accountNumber: 'src-1',
  });
  targetWallet = await Wallet.create({
    userId: uid,
    name: 'Ví chính',
    type: 'bank',
    balance: 5000000,
    accountNumber: 'dst-1',
  });

  await Category.create([
    { name: 'Tiết kiệm', type: 'expense', isDefault: true },
    { name: 'Khác (Thu)', type: 'income', isDefault: true },
  ]);
});

describe('KAN-71: Goal 100% completion trigger', () => {
  it('hoàn tiền 100% về ví thụ hưởng, đổi trạng thái completed và bắn Push + Realtime chúc mừng', async () => {
    const goal = await Goal.create({
      userId: uid,
      name: 'Mua Laptop',
      targetAmount: 1000000,
      currentAmount: 600000,
      status: 'active',
      targetWalletId: targetWallet._id,
    });

    const req = {
      user: { id: String(uid) },
      params: { id: String(goal._id) },
      body: { amount: 400000, walletId: String(sourceWallet._id), note: 'Đợt cuối' },
    };
    const res = mockRes();

    await goalController.contribute(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.completed).toBe(true);

    const updatedGoal = await Goal.findById(goal._id);
    expect(updatedGoal.status).toBe('completed');
    expect(updatedGoal.completedAt).toBeTruthy();
    expect(updatedGoal.refundAmount).toBe(1000000);

    const refreshedSource = await Wallet.findById(sourceWallet._id);
    const refreshedTarget = await Wallet.findById(targetWallet._id);
    expect(refreshedSource.balance).toBe(1600000);
    expect(refreshedTarget.balance).toBe(6000000);

    expect(pushService.sendToUser).toHaveBeenCalledTimes(1);
    expect(pushService.sendToUser).toHaveBeenCalledWith(
      String(uid),
      expect.objectContaining({
        title: expect.stringMatching(/Chúc mừng/i),
        body: expect.stringContaining('Mua Laptop'),
        data: expect.objectContaining({
          type: 'goal_completed',
          goalId: String(goal._id),
          refundAmount: 1000000,
        }),
      })
    );

    expect(realtimeService.emitBalanceChange).toHaveBeenCalledTimes(1);
    expect(realtimeService.emitBalanceChange).toHaveBeenCalledWith(
      String(uid),
      expect.objectContaining({
        type: 'income',
        direction: 'in',
        amount: 1000000,
        walletId: String(targetWallet._id),
        walletName: 'Ví chính',
        newBalance: 6000000,
      })
    );

    expect(realtimeService.emitFinancialAlert).toHaveBeenCalledTimes(1);
    expect(realtimeService.emitFinancialAlert).toHaveBeenCalledWith(
      String(uid),
      expect.objectContaining({
        type: 'goal_completed',
        level: 'success',
        title: expect.stringMatching(/Chúc mừng/i),
        data: expect.objectContaining({
          goalId: String(goal._id),
          status: 'completed',
          refundAmount: 1000000,
        }),
      })
    );
  });

  it('không bắn thông báo hoàn thành khi đóng góp chưa đạt 100%', async () => {
    const goal = await Goal.create({
      userId: uid,
      name: 'Quỹ du lịch',
      targetAmount: 1000000,
      currentAmount: 200000,
      status: 'active',
      targetWalletId: targetWallet._id,
    });

    const req = {
      user: { id: String(uid) },
      params: { id: String(goal._id) },
      body: { amount: 300000, walletId: String(sourceWallet._id) },
    };
    const res = mockRes();

    await goalController.contribute(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.completed).toBe(false);
    expect(pushService.sendToUser).not.toHaveBeenCalled();
    expect(realtimeService.emitBalanceChange).not.toHaveBeenCalled();
    expect(realtimeService.emitFinancialAlert).not.toHaveBeenCalled();
  });

  it('vẫn trả về 201 và không rollback nếu Push Notification lỗi', async () => {
    pushService.sendToUser.mockRejectedValueOnce(new Error('Expo unreachable'));

    const goal = await Goal.create({
      userId: uid,
      name: 'Mua Xe',
      targetAmount: 500000,
      currentAmount: 0,
      status: 'active',
    });

    const req = {
      user: { id: String(uid) },
      params: { id: String(goal._id) },
      body: { amount: 500000, walletId: String(sourceWallet._id) },
    };
    const res = mockRes();

    await goalController.contribute(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.completed).toBe(true);
    expect((await Goal.findById(goal._id)).status).toBe('completed');
    expect(realtimeService.emitFinancialAlert).toHaveBeenCalledTimes(1);
  });
});
