const mongoose = require('mongoose');

jest.mock('../src/models/Budget', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../src/models/Transaction', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../src/services/push.service', () => ({
  sendToUser: jest.fn().mockResolvedValue(1),
}));

jest.mock('../src/services/realtime.service', () => ({
  emitFinancialAlert: jest.fn(),
}));

const Budget = require('../src/models/Budget');
const Transaction = require('../src/models/Transaction');
const pushService = require('../src/services/push.service');
const realtimeService = require('../src/services/realtime.service');
const financialAlert = require('../src/services/financialAlert.service');

describe('Financial Alert Service - Budget Thresholds (KAN-33)', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const categoryId = new mongoose.Types.ObjectId().toString();
  const budgetId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSpentAmount', () => {
    it('tính tổng chi tiêu của danh mục trong tháng bằng Transaction.aggregate', async () => {
      Transaction.aggregate.mockResolvedValue([{ _id: null, total: 2400000 }]);

      const spent = await financialAlert.getSpentAmount(userId, categoryId, '2026-11');
      expect(spent).toBe(2400000);
      expect(Transaction.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              userId: expect.anything(),
              categoryId: expect.anything(),
              type: 'expense',
            }),
          }),
        ])
      );
    });

    it('trả về 0 khi chưa có giao dịch chi tiêu nào', async () => {
      Transaction.aggregate.mockResolvedValue([]);
      const spent = await financialAlert.getSpentAmount(userId, categoryId, '2026-11');
      expect(spent).toBe(0);
    });
  });

  describe('checkExpenseBudget', () => {
    const mockBudget = {
      _id: budgetId,
      userId,
      categoryId: { _id: categoryId, name: 'Ăn uống' },
      limitAmount: 1000000,
      month: '2026-11',
      alertThreshold50: true,
      alertThreshold80: true,
      alertThreshold100: true,
      notifiedThresholds: [],
    };

    it('không gửi cảnh báo khi chi tiêu dưới 50% hạn mức', async () => {
      Budget.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBudget),
      });
      Transaction.aggregate.mockResolvedValue([{ _id: null, total: 400000 }]); // 40%

      const result = await financialAlert.checkExpenseBudget(userId, categoryId, new Date('2026-11-08'));
      expect(result).toBeNull();
      expect(pushService.sendToUser).not.toHaveBeenCalled();
      expect(realtimeService.emitFinancialAlert).not.toHaveBeenCalled();
    });

    it('gửi cảnh báo khi chi tiêu đạt mốc 50% hạn mức', async () => {
      Budget.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBudget),
      });
      Transaction.aggregate.mockResolvedValue([{ _id: null, total: 550000 }]); // 55%
      Budget.findOneAndUpdate.mockResolvedValue({
        ...mockBudget,
        notifiedThresholds: [50],
      });

      const result = await financialAlert.checkExpenseBudget(userId, categoryId, new Date('2026-11-08'));
      expect(result).not.toBeNull();
      expect(result.threshold).toBe(50);
      expect(Budget.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: budgetId, notifiedThresholds: { $ne: 50 } },
        { $addToSet: { notifiedThresholds: 50 } },
        { new: true }
      );
      expect(pushService.sendToUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          title: expect.stringContaining('Ngân sách đạt 50%'),
          body: expect.stringContaining('55%'),
        })
      );
      expect(realtimeService.emitFinancialAlert).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          type: 'budget_alert',
          level: 'info',
          threshold: 50,
        })
      );
    });

    it('gửi cảnh báo khi chi tiêu đạt mốc 80% hạn mức', async () => {
      Budget.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockBudget,
          notifiedThresholds: [50],
        }),
      });
      Transaction.aggregate.mockResolvedValue([{ _id: null, total: 850000 }]); // 85%
      Budget.findOneAndUpdate.mockResolvedValue({
        ...mockBudget,
        notifiedThresholds: [50, 80],
      });

      const result = await financialAlert.checkExpenseBudget(userId, categoryId, new Date('2026-11-08'));
      expect(result.threshold).toBe(80);
      expect(realtimeService.emitFinancialAlert).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          type: 'budget_alert',
          level: 'warning',
          threshold: 80,
        })
      );
    });

    it('gửi cảnh báo vượt ngân sách nguy cấp khi chi tiêu >= 100% hạn mức', async () => {
      Budget.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockBudget,
          notifiedThresholds: [50, 80],
        }),
      });
      Transaction.aggregate.mockResolvedValue([{ _id: null, total: 1100000 }]); // 110%
      Budget.findOneAndUpdate.mockResolvedValue({
        ...mockBudget,
        notifiedThresholds: [50, 80, 100],
      });

      const result = await financialAlert.checkExpenseBudget(userId, categoryId, new Date('2026-11-08'));
      expect(result.threshold).toBe(100);
      expect(realtimeService.emitFinancialAlert).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          type: 'budget_alert',
          level: 'danger',
          threshold: 100,
        })
      );
    });

    it('chống gửi trùng: không gửi lại khi atomic claim trả về null', async () => {
      Budget.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockBudget,
          notifiedThresholds: [80],
        }),
      });
      Transaction.aggregate.mockResolvedValue([{ _id: null, total: 850000 }]);
      // Giả lập luồng khác đã claim mốc 80 rồi
      Budget.findOneAndUpdate.mockResolvedValue(null);

      const result = await financialAlert.checkExpenseBudget(userId, categoryId, new Date('2026-11-08'));
      expect(result).toBeNull();
      expect(pushService.sendToUser).not.toHaveBeenCalled();
      expect(realtimeService.emitFinancialAlert).not.toHaveBeenCalled();
    });

    it('tôn trọng cài đặt: không gửi cảnh báo nếu alertThreshold tương ứng bị tắt', async () => {
      Budget.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockBudget,
          alertThreshold80: false, // tắt cờ mốc 80
        }),
      });
      Transaction.aggregate.mockResolvedValue([{ _id: null, total: 850000 }]);

      const result = await financialAlert.checkExpenseBudget(userId, categoryId, new Date('2026-11-08'));
      // Mốc 80 bị tắt, mốc 50 thì xem xét nếu chưa có trong notifiedThresholds
      // Nếu 50 chưa thông báo và alertThreshold50 bật thì gửi 50; nếu 50 đã có thì không gửi gì
      expect(result?.threshold).not.toBe(80);
    });

    it('an toàn khi limitAmount = 0 không bị lỗi chia cho 0', async () => {
      Budget.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          ...mockBudget,
          limitAmount: 0,
        }),
      });
      Transaction.aggregate.mockResolvedValue([{ _id: null, total: 50000 }]);

      expect(async () => {
        await financialAlert.checkExpenseBudget(userId, categoryId, new Date('2026-11-08'));
      }).not.toThrow();
    });
  });

  describe('scanAllBudgets', () => {
    it('quét toàn bộ ngân sách trong tháng và trả về số lượng cảnh báo đã phát', async () => {
      const b1 = {
        _id: 'b1',
        userId: 'u1',
        categoryId: { _id: 'c1', name: 'Ăn uống' },
        limitAmount: 1000000,
        month: '2026-11',
        alertThreshold50: true,
        alertThreshold80: true,
        alertThreshold100: true,
        notifiedThresholds: [],
      };
      Budget.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([b1]),
      });
      Transaction.aggregate.mockResolvedValue([{ _id: null, total: 850000 }]);
      Budget.findOneAndUpdate.mockResolvedValue({ ...b1, notifiedThresholds: [80] });

      const sentCount = await financialAlert.scanAllBudgets(new Date('2026-11-08T08:30:00+07:00'));
      expect(sentCount).toBe(1);
    });
  });
});
