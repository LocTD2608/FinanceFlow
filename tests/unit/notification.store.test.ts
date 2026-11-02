import { useNotificationStore } from '../../src/store/useNotificationStore';

describe('Notification Store', () => {
  it('enqueues and dismisses notification', () => {
    expect(useNotificationStore.getState().currentNotification).toBeNull();
    useNotificationStore.getState().notify({
      id: 'test_1',
      type: 'income',
      direction: 'in',
      amount: 500000,
      walletName: 'Ví tiền mặt',
      newBalance: 2500000,
      timestamp: new Date().toISOString(),
    });
    expect(useNotificationStore.getState().currentNotification?.amount).toBe(500000);
    expect(useNotificationStore.getState().currentNotification?.direction).toBe('in');
    useNotificationStore.getState().dismiss();
    expect(useNotificationStore.getState().currentNotification).toBeNull();
  });
});
