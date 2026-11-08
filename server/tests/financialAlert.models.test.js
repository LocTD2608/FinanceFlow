const Budget = require('../src/models/Budget');
const Goal = require('../src/models/Goal');

describe('Financial Alert Models Schema (KAN-33)', () => {
  describe('Budget Model', () => {
    it('chứa trường notifiedThresholds kiểu Array với mặc định rỗng', () => {
      const budget = new Budget({
        userId: '507f1f77bcf86cd799439011',
        categoryId: '507f1f77bcf86cd799439012',
        limitAmount: 5000000,
        month: '2026-11',
      });

      expect(budget.schema.paths.notifiedThresholds).toBeDefined();
      expect(Array.isArray(budget.notifiedThresholds)).toBe(true);
      expect(budget.notifiedThresholds).toHaveLength(0);
    });
  });

  describe('Goal Model', () => {
    it('chứa các trường notifiedStages và lastSalaryReminderMonth với giá trị khởi tạo đúng', () => {
      const goal = new Goal({
        userId: '507f1f77bcf86cd799439011',
        name: 'Tiết kiệm mua xe',
        targetAmount: 50000000,
      });

      expect(goal.schema.paths.notifiedStages).toBeDefined();
      expect(Array.isArray(goal.notifiedStages)).toBe(true);
      expect(goal.notifiedStages).toHaveLength(0);

      expect(goal.schema.paths.lastSalaryReminderMonth).toBeDefined();
      expect(goal.lastSalaryReminderMonth).toBeNull();
    });
  });
});
