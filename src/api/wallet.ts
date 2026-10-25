import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ROOT_API_URL } from './config';

export interface WalletItem {
  _id: string;
  id?: string;
  userId: string;
  name: string;
  type: 'cash' | 'bank' | 'credit_card' | 'savings' | 'investment';
  balance: number;
  currency: string;
  accountNumber?: string | null;
  bankName?: string | null;
  isExcludedFromNetWorth?: boolean;
  isArchived?: boolean;
}

const API_BASE_URL = `${ROOT_API_URL}/wallets`;
const LOCAL_WALLETS_KEY = '@financeflow_local_wallets';

export const walletApi = {
  async getWallets(token?: string) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(API_BASE_URL, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch {
      const raw = await AsyncStorage.getItem(LOCAL_WALLETS_KEY);
      const wallets: WalletItem[] = raw ? JSON.parse(raw) : [
        {
          _id: 'w_cash_default',
          id: 'w_cash_default',
          userId: 'local_user',
          name: 'Ví tiền mặt',
          type: 'cash',
          balance: 2500000,
          currency: 'VND',
        },
      ];
      return { success: true, data: wallets };
    }
  },

  async getDefaultWallet(token?: string): Promise<WalletItem | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE_URL}/default`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success && data.data) return data.data;
      return null;
    } catch {
      const walletsRes = await this.getWallets(token);
      if (walletsRes.success && walletsRes.data?.length > 0) {
        return walletsRes.data[0];
      }
      return null;
    }
  },
};
