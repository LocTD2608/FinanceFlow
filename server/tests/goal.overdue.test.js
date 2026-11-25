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
const Wallet = require('../src/models/Wallet');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const goalLifecycleService = require('../src/services/goalLifecycle.service');
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
let otherUid;
let mainWallet;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: '7.0.14' },
  });
  await mongoose.connect(mongo.getUri(), { dbName: 'kan70_test' });
  await Promise.all([Goal, Wallet, Category, Transaction].map((m) => m.init()));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([Goal, Wallet, Category, Transaction].map((m) => m.deleteMany({})));
  jest.clearAllMocks();
  pushService.sendToUser.mockResolvedValue(1);

  uid = new mongoose.Types.ObjectId();
  otherUid = new mongoose.Types.ObjectId();
  mainWallet = await Wallet.create({
    userId: uid,
    name: 'Ví chính',
    type: 'cash',
    balance: 1000000,
    accountNumber: 'main-1',
  });
  await Category.create([
    { name: 'Tiết kiệm', type: 'expense', isDefault: true },
    { name: 'Khác (Thu)', type: 'income', isDefault: true },
  ]);
});

describe('KAN-70: Overdue Goal 24h Decision Flow', () => {
  it('khi quá hạn ở lần quét 0:00 -> đặt grace_24h, decisionRequiredAt = +24h và bắn thông báo hỏi gia hạn (không trùng lặp)', async () => {
    const t0 = new Date('2026-11-26T00:00:00+07:00');
    const goal = await Goal.create({
      userId: uid,
      name: 'Quỹ dự phòng',
      targetAmount: 5000000,
      currentAmount: 2000000,
      deadline: new Date('2026-11-25T23:59:59+07:00'),
      status: 'active',
    });

    const first = await goalLifecycleService.scanDueGoals(t0);
    expect(first.graceStartedCount).toBe(1);

    const updated = await Goal.findById(goal._id);
    expect(updated.overdueStage).toBe('grace_24h');
    expect(updated.overdueNotifiedAt.getTime()).toBe(t0.getTime());
    expect(updated.decisionRequiredAt.getTime()).toBe(t0.getTime() + 24 * 60 * 60 * 1000);

    expect(pushService.sendToUser).toHaveBeenCalledWith(
      String(uid),
      expect.objectContaining({
        data: expect.objectContaining({ type: 'goal_overdue', goalId: String(goal._id) }),
      })
    );
    expect(realtimeService.emitFinancialAlert).toHaveBeenCalledWith(
      String(uid),
      expect.objectContaining({
        type: 'goal_overdue',
        level: 'warning',
      })
    );

    // Chạy lại sau 1 giờ -> không gửi lại thông báo grace_24h
    jest.clearAllMocks();
    const second = await goalLifecycleService.scanDueGoals(new Date('2026-11-26T01:00:00+07:00'));
    expect(second.graceStartedCount).toBe(0);
    expect(pushService.sendToUser).not.toHaveBeenCalled();
  });

  it('sau 24h không gia hạn -> chuyển sang decision_required và getPendingDecision trả về cho đúng user', async () => {
    const t0 = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const goal = await Goal.create({
      userId: uid,
      name: 'Mua xe máy',
      targetAmount: 30000000,
      currentAmount: 10000000,
      deadline: new Date(Date.now() - 48 * 60 * 60 * 1000),
      status: 'active',
      overdueStage: 'grace_24h',
      overdueNotifiedAt: t0,
      decisionRequiredAt: new Date(t0.getTime() + 24 * 60 * 60 * 1000),
    });

    // Goal của user khác không được rò rỉ
    await Goal.create({
      userId: otherUid,
      name: 'Mục tiêu người khác',
      targetAmount: 1000000,
      currentAmount: 500000,
      deadline: new Date('2026-11-24T00:00:00+07:00'),
      status: 'active',
      overdueStage: 'decision_required',
      decisionRequiredAt: t0,
    });

    const req = { user: { id: String(uid) } };
    const res = mockRes();

    await goalController.getPendingDecision(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const list = res.json.mock.calls[0][0].data;
    expect(list).toHaveLength(1);
    expect(String(list[0]._id)).toBe(String(goal._id));
    expect(list[0].overdueStage).toBe('decision_required');
  });

  it('extend cho phép gia hạn tiếp, reset overdueStage và tăng extensionCount', async () => {
    const goal = await Goal.create({
      userId: uid,
      name: 'Học tiếng Anh',
      targetAmount: 4000000,
      currentAmount: 1500000,
      deadline: new Date('2026-11-25T00:00:00+07:00'),
      status: 'active',
      overdueStage: 'decision_required',
      notifiedStages: ['d-7', 'd-3', 'd0'],
      overdueNotifiedAt: new Date('2026-11-26T00:00:00+07:00'),
      decisionRequiredAt: new Date('2026-11-27T00:00:00+07:00'),
    });

    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();
    const res = mockRes();
    await goalController.extend(
      { user: { id: String(uid) }, params: { id: String(goal._id) }, body: { newDeadline: futureDate } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const updated = await Goal.findById(goal._id);
    expect(updated.status).toBe('active');
    expect(updated.overdueStage).toBe('none');
    expect(updated.overdueNotifiedAt).toBeNull();
    expect(updated.decisionRequiredAt).toBeNull();
    expect(updated.notifiedStages).toEqual([]);
    expect(updated.extensionCount).toBe(1);
  });

  it('expireClose dừng gia hạn -> hoàn 100% tiền (0% phí phạt) về ví chính và đóng mục tiêu thành expired', async () => {
    const goal = await Goal.create({
      userId: uid,
      name: 'Đi Đà Lạt',
      targetAmount: 5000000,
      currentAmount: 2500000,
      deadline: new Date('2026-11-24T00:00:00+07:00'),
      status: 'active',
      overdueStage: 'decision_required',
      targetWalletId: mainWallet._id,
    });

    const res = mockRes();
    await goalController.expireClose(
      { user: { id: String(uid) }, params: { id: String(goal._id) } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.refundAmount).toBe(2500000);
    expect(body.data.penaltyFee).toBe(0);

    const updatedGoal = await Goal.findById(goal._id);
    expect(updatedGoal.status).toBe('expired');
    expect(updatedGoal.overdueStage).toBe('none');
    expect(updatedGoal.expiredAt).toBeTruthy();
    expect(updatedGoal.penaltyFee).toBe(0);
    expect(updatedGoal.refundAmount).toBe(2500000);

    const refreshedWallet = await Wallet.findById(mainWallet._id);
    expect(refreshedWallet.balance).toBe(3500000);

    const tx = await Transaction.findOne({ goalId: goal._id, type: 'income' });
    expect(tx).toBeTruthy();
    expect(tx.amount).toBe(2500000);

    expect(realtimeService.emitBalanceChange).toHaveBeenCalledWith(
      String(uid),
      expect.objectContaining({
        type: 'income',
        direction: 'in',
        amount: 2500000,
        newBalance: 3500000,
      })
    );
    expect(pushService.sendToUser).toHaveBeenCalledTimes(1);

    // Gọi lần 2 phải trả về 400
    const res2 = mockRes();
    await goalController.expireClose(
      { user: { id: String(uid) }, params: { id: String(goal._id) } },
      res2
    );
    expect(res2.status).toHaveBeenCalledWith(400);
  });
});
