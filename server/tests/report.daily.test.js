const mongoose = require('mongoose');

jest.mock('../src/models/Transaction', () => ({
  find: jest.fn(),
}));

const Transaction = require('../src/models/Transaction');
const reportCtrl = require('../src/controllers/report.controller');

const USER_ID = new mongoose.Types.ObjectId().toString();

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (query = {}) => ({
  user: { id: USER_ID },
  query,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Report Controller - Daily Report', () => {
  test('type không hợp lệ -> 400', async () => {
    const res = mockRes();
    await reportCtrl.getDailyReport(mockReq({ type: 'invalid' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('tháng không hợp lệ -> 400', async () => {
    const res = mockRes();
    await reportCtrl.getDailyReport(mockReq({ month: '2026-15' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('tháng 10/2026 không có giao dịch nào: series vẫn có đủ 31 ngày với amount = 0', async () => {
    Transaction.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const res = mockRes();
    await reportCtrl.getDailyReport(mockReq({ month: '2026-10' }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          month: '2026-10',
          total: 0,
          average: 0,
          series: expect.any(Array),
          days: [],
        }),
      })
    );

    const data = res.json.mock.calls[0][0].data;
    expect(data.series).toHaveLength(31);
    expect(data.series[0]).toEqual({ date: '2026-10-01', day: 1, amount: 0 });
    expect(data.series[30]).toEqual({ date: '2026-10-31', day: 31, amount: 0 });
  });

  test('gom nhóm giao dịch và tính max, average, days', async () => {
    // 01/10/2026 lúc 10:00 (giờ VN) = 03:00 UTC
    const date1 = new Date('2026-10-01T03:00:00.000Z');
    // 25/10/2026 lúc 12:00 (giờ VN) = 05:00 UTC
    const date25 = new Date('2026-10-25T05:00:00.000Z');

    const fakeTxs = [
      {
        _id: 't1',
        amount: 500000,
        type: 'expense',
        transactionDate: date1,
        note: 'Mua sam',
      },
      {
        _id: 't2',
        amount: 200000,
        type: 'expense',
        transactionDate: date1,
        note: 'An uong',
      },
      {
        _id: 't3',
        amount: 56000,
        type: 'expense',
        transactionDate: date25,
        note: 'Tien xang',
      },
    ];

    Transaction.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(fakeTxs),
    });

    const res = mockRes();
    await reportCtrl.getDailyReport(mockReq({ month: '2026-10', type: 'expense' }), res);

    const data = res.json.mock.calls[0][0].data;
    expect(data.total).toBe(756000);
    expect(data.max).toEqual({ date: '2026-10-01', amount: 700000 });

    // Ngày 1 có 700.000
    expect(data.series[0].amount).toBe(700000);
    // Ngày 25 có 56.000
    expect(data.series[24].amount).toBe(56000);

    // Mảng days chứa 2 ngày, ngày 25 xếp trước ngày 1 (mới nhất lên trước)
    expect(data.days).toHaveLength(2);
    expect(data.days[0].date).toBe('2026-10-25');
    expect(data.days[0].records).toHaveLength(1);
    expect(data.days[1].date).toBe('2026-10-01');
    expect(data.days[1].records).toHaveLength(2);
  });
});
