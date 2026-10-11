/**
 * Unit test cho API Dashboard (controller). Model được mock, không cần MongoDB.
 */
const mongoose = require('mongoose');

jest.mock('../src/models/Transaction', () => ({ aggregate: jest.fn() }));
jest.mock('../src/models/Wallet', () => ({ aggregate: jest.fn() }));

const Transaction = require('../src/models/Transaction');
const Wallet = require('../src/models/Wallet');
const ctrl = require('../src/controllers/dashboard.controller');

const USER_ID = new mongoose.Types.ObjectId().toString();

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockReq = (query = {}) => ({ user: { id: USER_ID }, query });
const body = (res) => res.json.mock.calls[0][0];

beforeEach(() => {
  jest.resetAllMocks();
});

describe('summary', () => {
  it('period sai -> 400', async () => {
    const res = mockRes();
    await ctrl.summary(mockReq({ period: 'day' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('date sai -> 400', async () => {
    const res = mockRes();
    await ctrl.summary(mockReq({ date: '2026-13-01' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('không có giao dịch -> tổng 0, changePercent null', async () => {
    Transaction.aggregate.mockResolvedValue([]);
    Wallet.aggregate.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.summary(mockReq({ period: 'month', date: '2026-10-11' }), res);

    const { data } = body(res);
    expect(data.totalIncome).toBe(0);
    expect(data.totalExpense).toBe(0);
    expect(data.balance).toBe(0);
    expect(data.comparison.income.changePercent).toBeNull();
    expect(data.comparison.expense.changePercent).toBeNull();
  });

  it('tính tổng, netChange, so sánh kỳ trước và số dư', async () => {
    Transaction.aggregate
      .mockResolvedValueOnce([
        { _id: 'income', total: 15000000 },
        { _id: 'expense', total: 6200000 },
      ])
      .mockResolvedValueOnce([
        { _id: 'income', total: 12000000 },
        { _id: 'expense', total: 8000000 },
      ]);
    Wallet.aggregate.mockResolvedValue([{ _id: null, total: 23500000 }]);
    const res = mockRes();

    await ctrl.summary(mockReq({ period: 'month', date: '2026-10-11' }), res);

    const { data } = body(res);
    expect(data.from).toBe('2026-10-01');
    expect(data.to).toBe('2026-10-31');
    expect(data.totalIncome).toBe(15000000);
    expect(data.totalExpense).toBe(6200000);
    expect(data.netChange).toBe(8800000);
    expect(data.balance).toBe(23500000);
    expect(data.comparison.previousPeriod).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(data.comparison.income.changePercent).toBe(25);
    expect(data.comparison.expense.changePercent).toBe(-22.5);
  });

  it('chỉ tính income/expense (bỏ transfer) và ví chưa archived, không bị loại net worth', async () => {
    Transaction.aggregate.mockResolvedValue([]);
    Wallet.aggregate.mockResolvedValue([]);
    await ctrl.summary(mockReq(), mockRes());

    const txMatch = Transaction.aggregate.mock.calls[0][0][0].$match;
    expect([...txMatch.type.$in].sort()).toEqual(['expense', 'income']);
    expect(txMatch.type.$in).not.toContain('transfer');
    const walletMatch = Wallet.aggregate.mock.calls[0][0][0].$match;
    expect(walletMatch.isArchived).toBe(false);
    expect(walletMatch.isExcludedFromNetWorth).toBe(false);
  });

  it('lỗi DB -> 500', async () => {
    Transaction.aggregate.mockRejectedValue(new Error('db'));
    Wallet.aggregate.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.summary(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('breakdown', () => {
  it('thiếu/sai type -> 400', async () => {
    const res = mockRes();
    await ctrl.breakdown(mockReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });

  it('period sai -> 400', async () => {
    const res = mockRes();
    await ctrl.breakdown(mockReq({ type: 'expense', period: 'abc' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('không có dữ liệu -> items rỗng, total 0', async () => {
    Transaction.aggregate.mockResolvedValue([]);
    const res = mockRes();
    await ctrl.breakdown(mockReq({ type: 'expense' }), res);
    expect(body(res).data.items).toEqual([]);
    expect(body(res).data.total).toBe(0);
  });

  it('trả items giảm dần, tính percent, tổng khớp', async () => {
    Transaction.aggregate.mockResolvedValue([
      { _id: 'c1', amount: 3000000, category: { name: 'Ăn uống', icon: 'utensils', color: '#F97316' } },
      { _id: 'c2', amount: 1000000, category: { name: 'Đi lại', icon: 'car', color: '#3B82F6' } },
    ]);
    const res = mockRes();
    await ctrl.breakdown(mockReq({ type: 'expense', period: 'month', date: '2026-10-11' }), res);

    const { data } = body(res);
    expect(data.total).toBe(4000000);
    expect(data.items[0]).toMatchObject({ name: 'Ăn uống', amount: 3000000, percent: 75 });
    expect(data.items[1]).toMatchObject({ name: 'Đi lại', percent: 25 });
    const sum = data.items.reduce((s, i) => s + i.percent, 0);
    expect(sum).toBeCloseTo(100, 1);

    const match = Transaction.aggregate.mock.calls[0][0][0].$match;
    expect(match.type).toBe('expense');
    expect(Transaction.aggregate.mock.calls[0][0].some((s) => s.$sort)).toBe(true);
  });

  it('danh mục không còn tồn tại -> dùng giá trị mặc định', async () => {
    Transaction.aggregate.mockResolvedValue([{ _id: 'gone', amount: 500 }]);
    const res = mockRes();
    await ctrl.breakdown(mockReq({ type: 'income' }), res);
    expect(body(res).data.items[0].name).toBe('Không xác định');
  });
});
