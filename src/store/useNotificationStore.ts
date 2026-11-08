import { create } from 'zustand';

export interface BalanceNotification {
  id: string;
  kind?: 'balance' | 'financial_alert';
  type?: 'income' | 'expense' | 'transfer' | 'budget_alert' | 'savings_reminder' | string;
  direction?: 'in' | 'out';
  amount?: number;
  walletName?: string;
  newBalance?: number;
  note?: string;
  timestamp?: string;
  // Financial Alert fields (KAN-33)
  level?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  body?: string;
  threshold?: number;
  data?: any;
}

export type FinancialAlertNotification = BalanceNotification;
export type AppNotification = BalanceNotification;

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
