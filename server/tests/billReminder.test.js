const mongoose = require('mongoose');

jest.mock('../src/models/BillReminder', () => ({
  find: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  findOneAndDelete: jest.fn(),
}));
jest.mock('../src/models/Wallet', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../src/models/Category', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/Transaction', () => ({ create: jest.fn() }));
jest.mock('../src/services/push.service', () => ({ sendToUser: jest.fn() }));

const Bill = require('../src/models/BillReminder');
const Wallet = require('../src/models/Wallet');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const push = require('../src/services/push.service');
const ctrl = require('../src/controllers/billReminder.controller');
const job = require('../src/jobs/billReminder.job');

const newId = () => new mongoose.Types.ObjectId().toString();
const USER_ID = newId();
const WALLET_ID = newId();
const BILL_ID = newId();

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockReq = (body = {}, params = {}, query = {}) => ({ user: { id: USER_ID }, params, query, body });
const out = (res) => res.json.mock.calls[0][0];

beforeEach(() => jest.resetAllMocks());

describe('nextDueDate', () => {
  test('hàng tuần +7 ngày', () => {
    expect(ctrl.nextDueDate('2026-10-01T01:00:00Z', 'weekly').toISOString()).toBe('2026-10-08T01:00:00.000Z');
  });
  test('hàng tháng, cắt về cuối tháng ngắn', () => {
    // 31/01 (giờ VN) -> 28/02
    const next = ctrl.nextDueDate('2026-01-31T01:00:00Z', 'monthly');
    expect(next.toISOString()).toBe('2026-02-28T01:00:00.000Z');
  });
  test('none -> null', () => {
    expect(ctrl.nextDueDate('2026-01-31T01:00:00Z', 'none')).toBeNull();
  });
});

describe('create', () => {
  test.each([
    [{ title: '', amount: 1, dueDate: '2026-11-01' }],
    [{ title: 'Điện', amount: 0, dueDate: '2026-11-01' }],
    [{ title: 'Điện', amount: 1, dueDate: 'abc' }],
    [{ title: 'Điện', amount: 1, dueDate: '2026-11-01', repeatCycle: 'daily' }],
  ])('dữ liệu sai bị từ chối %#', async (b) => {
    const res = mockRes();
    await ctrl.create(mockReq(b), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Bill.create).not.toHaveBeenCalled();
  });

  test('hợp lệ', async () => {
    Bill.create.mockResolvedValue({ _id: BILL_ID });
    const res = mockRes();
    await ctrl.create(mockReq({ title: 'Điện', amount: 500000, dueDate: '2026-11-01' }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Bill.create).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID, title: 'Điện' }));
  });
});

describe('pay', () => {
  const bill = (over = {}) => ({
    _id: BILL_ID,
    title: 'Điện',
    amount: 300000,
    dueDate: new Date('2026-11-01T01:00:00Z'),
    repeatCycle: 'monthly',
    ...over,
  });
  const setup = () => {
    Wallet.findOne.mockResolvedValue({ _id: WALLET_ID, type: 'cash', balance: 500000 });
    Category.findOne.mockResolvedValue({ _id: newId() });
  };

  test('trả thành công: tạo giao dịch chi và kỳ kế tiếp', async () => {
    setup();
    Bill.findOneAndUpdate.mockResolvedValue(bill());
    Wallet.findOneAndUpdate.mockResolvedValue({ balance: 200000 });
    Transaction.create.mockResolvedValue({ _id: 't1' });
    Bill.create.mockResolvedValue({ _id: 'next' });
    const res = mockRes();
    await ctrl.pay(mockReq({ walletId: WALLET_ID }, { id: BILL_ID }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Transaction.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'expense', amount: 300000 }));
    expect(Bill.create).toHaveBeenCalledWith(expect.objectContaining({ repeatCycle: 'monthly' }));
  });

  test('không lặp: không tạo kỳ mới', async () => {
    setup();
    Bill.findOneAndUpdate.mockResolvedValue(bill({ repeatCycle: 'none' }));
    Wallet.findOneAndUpdate.mockResolvedValue({ balance: 200000 });
    Transaction.create.mockResolvedValue({ _id: 't1' });
    const res = mockRes();
    await ctrl.pay(mockReq({ walletId: WALLET_ID }, { id: BILL_ID }), res);
    expect(Bill.create).not.toHaveBeenCalled();
  });

  test('thiếu số dư: INSUFFICIENT_BALANCE và mở lại hóa đơn', async () => {
    setup();
    Bill.findOneAndUpdate.mockResolvedValue(bill());
    Wallet.findOneAndUpdate.mockResolvedValue(null);
    Wallet.findById.mockResolvedValue({ balance: 100 });
    const res = mockRes();
    await ctrl.pay(mockReq({ walletId: WALLET_ID }, { id: BILL_ID }), res);
    expect(out(res).code).toBe('INSUFFICIENT_BALANCE');
    expect(Bill.updateOne).toHaveBeenCalledWith({ _id: BILL_ID }, { $set: { status: 'pending', paidAt: null } });
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test('hóa đơn đã trả: 404', async () => {
    setup();
    Bill.findOneAndUpdate.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.pay(mockReq({ walletId: WALLET_ID }, { id: BILL_ID }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('job nhắc hóa đơn', () => {
  const NOW = new Date('2026-10-26T01:00:00Z'); // 08:00 VN

  test.each([
    ['2026-10-29T05:00:00Z', 'd-3'],
    ['2026-10-27T05:00:00Z', 'd-1'],
    ['2026-10-26T15:00:00Z', 'd0'],
    ['2026-10-24T05:00:00Z', 'overdue'],
    ['2026-10-31T05:00:00Z', null],
  ])('due %s -> %s', (due, stage) => {
    expect(job.stageFor(job.dayDiff(due, NOW))).toBe(stage);
  });

  test('gửi thông báo và khóa mốc', async () => {
    Bill.find.mockResolvedValue([
      { _id: 'b1', userId: 'u1', title: 'Điện', amount: 100000, dueDate: new Date('2026-10-27T05:00:00Z'), notifiedStages: [] },
    ]);
    Bill.findOneAndUpdate.mockResolvedValue({ _id: 'b1' });
    push.sendToUser.mockResolvedValue(1);
    const n = await job.run(NOW);
    expect(n).toBe(1);
    expect(Bill.findOneAndUpdate.mock.calls[0][1]).toEqual({ $addToSet: { notifiedStages: 'd-1' } });
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
  });

  test('mốc đã gửi thì bỏ qua (không trùng)', async () => {
    Bill.find.mockResolvedValue([
      { _id: 'b1', userId: 'u1', title: 'Điện', amount: 1, dueDate: new Date('2026-10-27T05:00:00Z'), notifiedStages: ['d-1'] },
    ]);
    expect(await job.run(NOW)).toBe(0);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  test('tiến trình khác đã khóa mốc: không gửi', async () => {
    Bill.find.mockResolvedValue([
      { _id: 'b1', userId: 'u1', title: 'Điện', amount: 1, dueDate: new Date('2026-10-27T05:00:00Z'), notifiedStages: [] },
    ]);
    Bill.findOneAndUpdate.mockResolvedValue(null);
    expect(await job.run(NOW)).toBe(0);
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});
