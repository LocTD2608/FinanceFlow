import { dispatchBalanceNotification } from '../../src/services/socketService';
import { useNotificationStore } from '../../src/store/useNotificationStore';

describe('Socket Service and Local Dispatch', () => {
  beforeEach(() => {
    useNotificationStore.getState().dismiss();
  });

  it('dispatchBalanceNotification triggers notification store and format amount', () => {
    dispatchBalanceNotification({
      type: 'income',
      direction: 'in',
      amount: 1000000,
      walletName: 'MB Bank',
      newBalance: 15000000,
      note: 'Thưởng KPI',
    });
    const current = useNotificationStore.getState().currentNotification;
    expect(current).toBeDefined();
    expect(current?.amount).toBe(1000000);
    expect(current?.walletName).toBe('MB Bank');
  });
});
