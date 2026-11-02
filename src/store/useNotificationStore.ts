import { create } from 'zustand';

export interface BalanceNotification {
  id: string;
  type?: 'income' | 'expense' | 'transfer';
  direction: 'in' | 'out';
  amount: number;
  walletName: string;
  newBalance?: number;
  note?: string;
  timestamp?: string;
}

interface NotificationState {
  currentNotification: BalanceNotification | null;
  notify: (notification: BalanceNotification) => void;
  dismiss: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  currentNotification: null,

  notify: (notification: BalanceNotification) => {
    set({ currentNotification: notification });
  },

  dismiss: () => {
    set({ currentNotification: null });
  },
}));
