import { dispatchBalanceNotification } from '../../src/services/socketService';
import { useNotificationStore } from '../../src/store/useNotificationStore';
import { p2pApi } from '../../src/api/p2p';
import { securityApi } from '../../src/api/security';

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

  it('p2pApi.transfer triggers balance notification on transfer', async () => {
    jest.spyOn(securityApi, 'verifyPin').mockResolvedValue({ success: true });

    await p2pApi.transfer('mock_token', {
      recipientId: 'rec_alice',
      amount: 50000,
      pin: '123456',
      note: 'Trả tiền cafe',
    });

    const notif = useNotificationStore.getState().currentNotification;
    expect(notif).toBeDefined();
    expect(notif?.amount).toBe(50000);
    expect(notif?.direction).toBe('out');
  });
});
