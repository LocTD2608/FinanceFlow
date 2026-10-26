jest.mock('../src/models/Wallet', () => ({ aggregate: jest.fn() }));
jest.mock('../src/models/NetWorthSnapshot', () => ({ bulkWrite: jest.fn(), find: jest.fn() }));

const Wallet = require('../src/models/Wallet');
const Snapshot = require('../src/models/NetWorthSnapshot');
const svc = require('../src/services/netWorth.service');
const job = require('../src/jobs/netWorth.job');

beforeEach(() => jest.resetAllMocks());

describe('ngày cuối tháng (giờ VN)', () => {
  // 16:30 UTC = 23:30 VN cùng ngày
  test.each([
    ['2026-02-28T16:30:00Z', true], // tháng 2 thường
    ['2028-02-28T16:30:00Z', false], // năm nhuận: 28 chưa phải cuối tháng
    ['2028-02-29T16:30:00Z', true],
    ['2026-04-30T16:30:00Z', true], // tháng 30 ngày
    ['2026-04-29T16:30:00Z', false],
    ['2026-01-31T16:30:00Z', true], // tháng 31 ngày
    ['2026-01-30T16:30:00Z', false],
  ])('%s -> %p', (iso, expected) => {
    expect(svc.isLastDayOfMonth(new Date(iso))).toBe(expected);
  });

  test('tháng theo múi giờ VN: 17:00 UTC ngày 31 đã sang tháng sau', () => {
    expect(svc.currentMonth(new Date('2026-01-31T17:00:00Z'))).toBe('2026-02');
    expect(svc.previousMonth(new Date('2026-01-15T00:00:00Z'))).toBe('2025-12');
  });
});

describe('snapshotAll', () => {
  test('upsert theo {userId, month}, tính netWorth = tài sản - nợ', async () => {
    Wallet.aggregate.mockResolvedValue([{ _id: 'u1', totalAssets: 1000000, totalLiabilities: 300000 }]);
    const n = await svc.snapshotAll('2026-10');
    expect(n).toBe(1);
    const op = Snapshot.bulkWrite.mock.calls[0][0][0].updateOne;
    expect(op.filter).toEqual({ userId: 'u1', month: '2026-10' });
    expect(op.upsert).toBe(true);
    expect(op.update.$set.netWorth).toBe(700000);
  });

  test('overwrite=false dùng $setOnInsert (không ghi đè)', async () => {
    Wallet.aggregate.mockResolvedValue([{ _id: 'u1', totalAssets: 5, totalLiabilities: 0 }]);
    await svc.snapshotAll('2026-09', { overwrite: false });
    const op = Snapshot.bulkWrite.mock.calls[0][0][0].updateOne;
    expect(op.update.$setOnInsert).toBeDefined();
    expect(op.update.$set).toBeUndefined();
  });

  test('pipeline loại ví lưu trữ/loại khỏi tài sản ròng và chỉ tính nợ ví credit_card âm', async () => {
    Wallet.aggregate.mockResolvedValue([]);
    await svc.snapshotAll('2026-10');
    const pipeline = Wallet.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toMatchObject({ isArchived: { $ne: true }, isExcludedFromNetWorth: { $ne: true } });
    expect(JSON.stringify(pipeline[1])).toContain('credit_card');
    expect(Snapshot.bulkWrite).not.toHaveBeenCalled();
  });

  test('chạy 2 lần không tạo trùng (cùng filter upsert)', async () => {
    Wallet.aggregate.mockResolvedValue([{ _id: 'u1', totalAssets: 1, totalLiabilities: 0 }]);
    await svc.snapshotAll('2026-10');
    await svc.snapshotAll('2026-10');
    const [a, b] = Snapshot.bulkWrite.mock.calls.map((c) => c[0][0].updateOne.filter);
    expect(a).toEqual(b);
  });
});

describe('job cuối tháng', () => {
  test('không chạy nếu chưa phải ngày cuối tháng', async () => {
    expect(await job.runMonthEnd(new Date('2026-01-30T16:30:00Z'))).toBe(0);
    expect(Wallet.aggregate).not.toHaveBeenCalled();
  });

  test('chạy vào ngày cuối tháng cho tháng hiện tại', async () => {
    Wallet.aggregate.mockResolvedValue([{ _id: 'u1', totalAssets: 1, totalLiabilities: 0 }]);
    await job.runMonthEnd(new Date('2026-01-31T16:30:00Z'));
    expect(Snapshot.bulkWrite.mock.calls[0][0][0].updateOne.filter.month).toBe('2026-01');
  });
});

describe('getTrend', () => {
  test('giới hạn số tháng và trả tăng dần', async () => {
    const chain = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ month: '2026-10' }, { month: '2026-09' }]) };
    Snapshot.find.mockReturnValue(chain);
    const data = await svc.getTrend('u1', 999);
    expect(chain.limit).toHaveBeenCalledWith(36);
    expect(data.map((d) => d.month)).toEqual(['2026-09', '2026-10']);
  });
});
