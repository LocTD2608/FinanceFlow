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
});
