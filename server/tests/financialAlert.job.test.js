const cron = require('node-cron');

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('../src/services/financialAlert.service', () => ({
  scanAllBudgets: jest.fn(),
  scanSavingsReminders: jest.fn(),
}));

const financialAlertService = require('../src/services/financialAlert.service');
const financialAlertJob = require('../src/jobs/financialAlert.job');

describe('Financial Alert Background Cron Job (KAN-33)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('run', () => {
    it('thực thi quét ngân sách và nhắc nhở tiết kiệm, trả về tổng số thông báo', async () => {
      financialAlertService.scanAllBudgets.mockResolvedValue(3);
      financialAlertService.scanSavingsReminders.mockResolvedValue(2);

      const now = new Date('2026-11-08T08:30:00+07:00');
      const result = await financialAlertJob.run(now);

      expect(financialAlertService.scanAllBudgets).toHaveBeenCalledWith(now);
      expect(financialAlertService.scanSavingsReminders).toHaveBeenCalledWith(now);
      expect(result).toEqual({
        budgetCount: 3,
        savingsCount: 2,
        total: 5,
      });
    });

    it('bắt lỗi gracefully khi một trong hai service phát sinh ngoại lệ', async () => {
      financialAlertService.scanAllBudgets.mockRejectedValue(new Error('DB Timeout'));
      financialAlertService.scanSavingsReminders.mockResolvedValue(1);

      const now = new Date('2026-11-08T08:30:00+07:00');
      const result = await financialAlertJob.run(now);

      expect(result.budgetCount).toBe(0);
      expect(result.savingsCount).toBe(1);
      expect(result.total).toBe(1);
    });
  });

  describe('start', () => {
    it('đăng ký lịch chạy cron lúc 08:30 sáng hàng ngày theo múi giờ Asia/Ho_Chi_Minh', () => {
      financialAlertJob.start();

      expect(cron.schedule).toHaveBeenCalledWith(
        '30 8 * * *',
        expect.any(Function),
        { timezone: 'Asia/Ho_Chi_Minh' }
      );
    });
  });
});
