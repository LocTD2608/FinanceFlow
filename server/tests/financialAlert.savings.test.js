const mongoose = require('mongoose');

jest.mock('../src/models/Goal', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../src/services/push.service', () => ({
  sendToUser: jest.fn().mockResolvedValue(1),
}));

jest.mock('../src/services/realtime.service', () => ({
  emitFinancialAlert: jest.fn(),
}));

const Goal = require('../src/models/Goal');
const pushService = require('../src/services/push.service');
const realtimeService = require('../src/services/realtime.service');
const financialAlert = require('../src/services/financialAlert.service');

describe('Financial Alert Service - Savings Goal Reminders (KAN-33)', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const goalId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dayDiff', () => {
    it('tính chính xác khoảng cách ngày theo giờ Việt Nam', () => {
      // 2026-11-08 và 2026-11-15: cách nhau đúng 7 ngày
      const now = new Date('2026-11-08T08:30:00+07:00');
      const deadline = new Date('2026-11-15T23:59:59+07:00');
      expect(financialAlert.dayDiff(deadline, now)).toBe(7);
    });
  });

  describe('scanSavingsReminders - Cận hạn chót (Deadline)', () => {
    it('gửi nhắc nhở khi còn 7 ngày đến hạn (stage d-7)', async () => {
      const now = new Date('2026-11-08T08:30:00+07:00');
      const deadline7 = new Date('2026-11-15T08:30:00+07:00');

      const mockGoal = {
        _id: goalId,
        userId: { _id: userId, salaryDay: 25 },
        name: 'Quỹ khẩn cấp',
        targetAmount: 10000000,
        currentAmount: 6000000,
        deadline: deadline7,
        status: 'active',
        notifiedStages: [],
        lastSalaryReminderMonth: null,
      };

      Goal.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([mockGoal]),
      });
      Goal.findOneAndUpdate.mockResolvedValue({
        ...mockGoal,
        notifiedStages: ['d-7'],
      });

      const sentCount = await financialAlert.scanSavingsReminders(now);
      expect(sentCount).toBe(1);

      expect(Goal.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: goalId, status: 'active', notifiedStages: { $ne: 'd-7' } },
        { $addToSet: { notifiedStages: 'd-7' } },
        { new: true }
      );
      expect(pushService.sendToUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          title: expect.stringContaining('mục tiêu tiết kiệm'),
          body: expect.stringContaining('7 ngày'),
        })
      );
      expect(realtimeService.emitFinancialAlert).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          type: 'savings_reminder',
          level: 'info',
        })
      );
    });

    it('gửi nhắc nhở khi còn 3 ngày đến hạn (stage d-3)', async () => {
      const now = new Date('2026-11-08T08:30:00+07:00');
      const deadline3 = new Date('2026-11-11T08:30:00+07:00');

      const mockGoal = {
        _id: goalId,
        userId: { _id: userId, salaryDay: 25 },
        name: 'Mua laptop mới',
        targetAmount: 20000000,
        currentAmount: 15000000,
        deadline: deadline3,
        status: 'active',
        notifiedStages: ['d-7'],
        lastSalaryReminderMonth: null,
      };

      Goal.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([mockGoal]),
      });
      Goal.findOneAndUpdate.mockResolvedValue({
        ...mockGoal,
        notifiedStages: ['d-7', 'd-3'],
      });

      const sentCount = await financialAlert.scanSavingsReminders(now);
      expect(sentCount).toBe(1);
      expect(Goal.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: goalId, status: 'active', notifiedStages: { $ne: 'd-3' } },
        { $addToSet: { notifiedStages: 'd-3' } },
        { new: true }
      );
    });

    it('không gửi nếu mốc d-3 đã có trong notifiedStages (chống trùng)', async () => {
      const now = new Date('2026-11-08T08:30:00+07:00');
      const deadline3 = new Date('2026-11-11T08:30:00+07:00');

      const mockGoal = {
        _id: goalId,
        userId: { _id: userId, salaryDay: 25 },
        name: 'Mua laptop mới',
        targetAmount: 20000000,
        currentAmount: 15000000,
        deadline: deadline3,
        status: 'active',
        notifiedStages: ['d-7', 'd-3'], // đã nhắc d-3 rồi
        lastSalaryReminderMonth: null,
      };

      Goal.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([mockGoal]),
      });

      const sentCount = await financialAlert.scanSavingsReminders(now);
      expect(sentCount).toBe(0);
      expect(pushService.sendToUser).not.toHaveBeenCalled();
    });

    it('bỏ qua nếu mục tiêu đã đạt 100% mục tiêu', async () => {
      const now = new Date('2026-11-08T08:30:00+07:00');
      const deadline3 = new Date('2026-11-11T08:30:00+07:00');

      const mockGoal = {
        _id: goalId,
        userId: { _id: userId, salaryDay: 25 },
        name: 'Đã hoàn thành',
        targetAmount: 10000000,
        currentAmount: 10000000, // Đã đủ tiền
        deadline: deadline3,
        status: 'active',
        notifiedStages: [],
      };

      Goal.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([mockGoal]),
      });

      const sentCount = await financialAlert.scanSavingsReminders(now);
      expect(sentCount).toBe(0);
    });
  });

  describe('scanSavingsReminders - Ngày nhận lương (Salary Day)', () => {
    it('gửi lời nhắc tích lũy khi trùng ngày salaryDay của user và chưa nhắc trong tháng', async () => {
      // Ngày 08 tháng 11, trùng user.salaryDay = 8
      const now = new Date('2026-11-08T08:30:00+07:00');

      const mockGoal = {
        _id: goalId,
        userId: { _id: userId, salaryDay: 8 },
        name: 'Du lịch Đà Nẵng',
        targetAmount: 10000000,
        currentAmount: 2000000,
        deadline: null, // không có deadline
        status: 'active',
        notifiedStages: [],
        lastSalaryReminderMonth: '2026-10', // tháng trước đã nhắc, tháng này chưa
      };

      Goal.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([mockGoal]),
      });
      Goal.findOneAndUpdate.mockResolvedValue({
        ...mockGoal,
        lastSalaryReminderMonth: '2026-11',
      });

      const sentCount = await financialAlert.scanSavingsReminders(now);
      expect(sentCount).toBe(1);

      expect(Goal.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: goalId, status: 'active', lastSalaryReminderMonth: { $ne: '2026-11' } },
        { $set: { lastSalaryReminderMonth: '2026-11' } },
        { new: true }
      );
      expect(pushService.sendToUser).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          title: expect.stringContaining('ngày nhận lương'),
        })
      );
      expect(realtimeService.emitFinancialAlert).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          type: 'savings_reminder',
          level: 'success',
        })
      );
    });

    it('không gửi lời nhắc ngày nhận lương lần 2 trong cùng một tháng', async () => {
      const now = new Date('2026-11-08T08:30:00+07:00');

      const mockGoal = {
        _id: goalId,
        userId: { _id: userId, salaryDay: 8 },
        name: 'Du lịch Đà Nẵng',
        targetAmount: 10000000,
        currentAmount: 2000000,
        deadline: null,
        status: 'active',
        notifiedStages: [],
        lastSalaryReminderMonth: '2026-11', // tháng này ĐÃ nhắc rồi
      };

      Goal.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([mockGoal]),
      });

      const sentCount = await financialAlert.scanSavingsReminders(now);
      expect(sentCount).toBe(0);
      expect(pushService.sendToUser).not.toHaveBeenCalled();
    });
  });
});
