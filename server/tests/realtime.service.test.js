const realtimeService = require('../src/services/realtime.service');

describe('Realtime Service emitBalanceChange', () => {
  let ioMock;
  beforeEach(() => {
    ioMock = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    jest.spyOn(require('../src/socket'), 'getIO').mockReturnValue(ioMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should emit balance:change to user room', () => {
    const payload = {
      type: 'income',
      direction: 'in',
      amount: 500000,
      walletName: 'Ví tiền mặt',
      newBalance: 2000000,
      note: 'Nạp tiền lương',
    };
    realtimeService.emitBalanceChange('u_123', payload);
    expect(ioMock.to).toHaveBeenCalledWith('user_u_123');
    expect(ioMock.emit).toHaveBeenCalledWith('balance:change', expect.objectContaining({
      type: 'income',
      direction: 'in',
      amount: 500000,
      walletName: 'Ví tiền mặt',
      newBalance: 2000000,
      timestamp: expect.any(String),
    }));
  });

  it('handles null socket gracefully without throwing', () => {
    require('../src/socket').getIO.mockReturnValue(null);
    expect(() => {
      realtimeService.emitBalanceChange('u_123', { amount: 100 });
    }).not.toThrow();
  });

  describe('emitFinancialAlert (KAN-33)', () => {
    it('phát sự kiện financial:alert tới room user với payload đầy đủ', () => {
      const alertData = {
        type: 'budget_alert',
        level: 'danger',
        title: 'Cảnh báo vượt ngân sách',
        body: 'Bạn đã chi tiêu đạt 100% hạn mức danh mục Ăn uống',
        data: { budgetId: 'b_123', threshold: 100 },
      };

      realtimeService.emitFinancialAlert('u_456', alertData);

      expect(ioMock.to).toHaveBeenCalledWith('user_u_456');
      expect(ioMock.emit).toHaveBeenCalledWith('financial:alert', expect.objectContaining({
        id: expect.any(String),
        type: 'budget_alert',
        level: 'danger',
        title: 'Cảnh báo vượt ngân sách',
        body: 'Bạn đã chi tiêu đạt 100% hạn mức danh mục Ăn uống',
        data: { budgetId: 'b_123', threshold: 100 },
        timestamp: expect.any(String),
      }));
    });

    it('không ném lỗi khi socket io là null', () => {
      require('../src/socket').getIO.mockReturnValue(null);
      expect(() => {
        realtimeService.emitFinancialAlert('u_456', { title: 'Test' });
      }).not.toThrow();
    });
  });
});
