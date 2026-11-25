const cron = require('node-cron');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('../src/services/push.service', () => ({
  sendToUser: jest.fn().mockResolvedValue(1),
}));

jest.mock('../src/services/realtime.service', () => ({
  emitBalanceChange: jest.fn(),
  emitFinancialAlert: jest.fn(),
}));

const Goal = require('../src/models/Goal');
const goalLifecycleService = require('../src/services/goalLifecycle.service');
const goalLifecycleJob = require('../src/jobs/goalLifecycle.job');

jest.setTimeout(120000);

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'kan69_test' });
  await Goal.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Goal.deleteMany({});
  jest.clearAllMocks();
});

describe('KAN-69: Daily 0:00 Goal Deadline Cronjob', () => {
  it('đăng ký lịch chạy cron mỗi ngày lúc 0:00 theo múi giờ Asia/Ho_Chi_Minh', () => {
    goalLifecycleJob.start();

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 0 * * *',
      expect.any(Function),
      { timezone: 'Asia/Ho_Chi_Minh' }
    );
  });

  it('quét toàn bộ DB lúc 0:00 và phát hiện chính xác các mục tiêu đến hạn hoặc quá hạn chưa hoàn thành', async () => {
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();
    const now = new Date('2026-11-26T00:00:00+07:00');

    // 1. Đến hạn hôm nay (2026-11-26)
    const dueToday = await Goal.create({
      userId: userA,
      name: 'Mua laptop',
      targetAmount: 10000000,
      currentAmount: 4000000,
      deadline: new Date('2026-11-26T12:00:00+07:00'),
      status: 'active',
    });

    // 2. Quá hạn (hạn hôm qua 2026-11-25)
    const overdue = await Goal.create({
      userId: userB,
      name: 'Quỹ du lịch',
      targetAmount: 5000000,
      currentAmount: 2000000,
      deadline: new Date('2026-11-25T23:59:59+07:00'),
      status: 'active',
    });

    // 3. Chưa đến hạn (2026-11-30) -> không quét vào due/overdue
    await Goal.create({
      userId: userA,
      name: 'Mua xe',
      targetAmount: 20000000,
      currentAmount: 1000000,
      deadline: new Date('2026-11-30T00:00:00+07:00'),
      status: 'active',
    });

    // 4. Đã hoàn thành hoặc đã đạt 100% -> bỏ qua
    await Goal.create({
      userId: userA,
      name: 'Quỹ đã đủ',
      targetAmount: 1000000,
      currentAmount: 1000000,
      deadline: new Date('2026-11-25T00:00:00+07:00'),
      status: 'active',
    });

    await Goal.create({
      userId: userB,
      name: 'Mục tiêu đã hủy',
      targetAmount: 1000000,
      currentAmount: 100000,
      deadline: new Date('2026-11-25T00:00:00+07:00'),
      status: 'cancelled',
    });

    const summary = await goalLifecycleJob.run(now);

    expect(summary.scannedCount).toBe(2);
    expect(summary.dueGoalIds).toEqual(expect.arrayContaining([String(dueToday._id)]));
    expect(summary.overdueGoalIds).toEqual(expect.arrayContaining([String(overdue._id)]));
    expect(summary.dueGoalIds).toHaveLength(1);
    expect(summary.overdueGoalIds).toHaveLength(1);
  });

  it('xử lý lỗi gracefully nếu service ném ngoại lệ', async () => {
    const spy = jest.spyOn(goalLifecycleService, 'scanDueGoals').mockRejectedValueOnce(new Error('DB down'));
    const res = await goalLifecycleJob.run(new Date('2026-11-26T00:00:00+07:00'));

    expect(res).toEqual(
      expect.objectContaining({
        scannedCount: 0,
        error: 'DB down',
      })
    );
    spy.mockRestore();
  });
});
