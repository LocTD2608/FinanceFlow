import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ROOT_API_URL } from './config';

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface WalletRef {
  _id?: string;
  id?: string;
  name: string;
  type: string;
  currency: string;
}

export interface CategoryRef {
  _id?: string;
  id?: string;
  name: string;
  icon: string;
  color: string;
  type: string;
}

export interface TransactionItem {
  _id: string;
  id?: string;
  userId: string;
  walletId: string | WalletRef;
  destinationWalletId?: string | WalletRef | null;
  categoryId?: string | CategoryRef | null;
  amount: number;
  type: TransactionType;
  transactionDate: string;
  note?: string;
  receiptImageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTransactionInput {
  amount: number;
  type: TransactionType;
  walletId: string;
  categoryId?: string;
  destinationWalletId?: string;
  transactionDate?: string;
  note?: string;
  receiptImageUrl?: string;
}

export interface CashFlowSummary {
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
}

const API_BASE_URL = `${ROOT_API_URL}/transactions`;
const LOCAL_TX_KEY = '@financeflow_local_transactions';
const LOCAL_WALLETS_KEY = '@financeflow_local_wallets';

export const transactionApi = {
  /**
   * Lấy danh sách giao dịch có phân trang và lọc theo tháng
   */
  async getTransactions(token?: string, query?: { month?: string; page?: number; limit?: number; type?: string }) {
    try {
      const qs = new URLSearchParams();
      if (query?.month) qs.append('month', query.month);
      if (query?.page) qs.append('page', String(query.page));
      if (query?.limit) qs.append('limit', String(query.limit));
      if (query?.type) qs.append('type', query.type);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE_URL}?${qs.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch {
      // Offline fallback: lấy từ AsyncStorage
      const raw = await AsyncStorage.getItem(LOCAL_TX_KEY);
      const items: TransactionItem[] = raw ? JSON.parse(raw) : [];
      let filtered = [...items];
      if (query?.type) {
        filtered = filtered.filter((t) => t.type === query.type);
      }
      if (query?.month) {
        filtered = filtered.filter((t) => (t.transactionDate || '').startsWith(query.month!));
      }
      return {
        success: true,
        data: filtered,
        pagination: { total: filtered.length, page: 1, limit: 50, totalPages: 1 },
      };
    }
  },

  /**
   * Tạo mới giao dịch (tự động cộng/trừ số dư ví)
   */
  async createTransaction(token: string | undefined, input: CreateTransactionInput) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch {
      // Offline fallback: Cập nhật số dư trong local wallets
      const rawWallets = await AsyncStorage.getItem(LOCAL_WALLETS_KEY);
      const wallets = rawWallets ? JSON.parse(rawWallets) : [
        { id: input.walletId, name: 'Ví mặc định', balance: 10000000, type: 'cash' },
      ];

      const sourceWallet = wallets.find((w: { id: string }) => w.id === input.walletId);
      if (sourceWallet) {
        if (input.type === 'expense') {
          sourceWallet.balance -= input.amount;
        } else if (input.type === 'income') {
          sourceWallet.balance += input.amount;
        } else if (input.type === 'transfer' && input.destinationWalletId) {
          sourceWallet.balance -= input.amount;
          const destWallet = wallets.find((w: { id: string }) => w.id === input.destinationWalletId);
          if (destWallet) destWallet.balance += input.amount;
        }
      }
      await AsyncStorage.setItem(LOCAL_WALLETS_KEY, JSON.stringify(wallets));

      const newTx: TransactionItem = {
        _id: `tx_${Date.now()}`,
        userId: 'local_user',
        walletId: input.walletId,
        destinationWalletId: input.destinationWalletId || null,
        categoryId: input.categoryId || null,
        amount: input.amount,
        type: input.type,
        transactionDate: input.transactionDate || new Date().toISOString(),
        note: input.note || '',
        createdAt: new Date().toISOString(),
      };

      const rawTx = await AsyncStorage.getItem(LOCAL_TX_KEY);
      const transactions: TransactionItem[] = rawTx ? JSON.parse(rawTx) : [];
      transactions.unshift(newTx);
      await AsyncStorage.setItem(LOCAL_TX_KEY, JSON.stringify(transactions));

      return {
        success: true,
        message: 'Ghi nhận giao dịch thành công (offline)!',
        data: newTx,
      };
    }
  },

  /**
   * Xóa giao dịch (tự động hoàn tác số dư ví)
   */
  async deleteTransaction(token: string | undefined, id: string) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch {
      // Offline fallback: Hoàn tác số dư
      const rawTx = await AsyncStorage.getItem(LOCAL_TX_KEY);
      let transactions: TransactionItem[] = rawTx ? JSON.parse(rawTx) : [];
      const tx = transactions.find((t) => t._id === id);
      if (tx) {
        const rawWallets = await AsyncStorage.getItem(LOCAL_WALLETS_KEY);
        const wallets = rawWallets ? JSON.parse(rawWallets) : [];
        const sourceWallet = wallets.find((w: { id: string }) => w.id === (typeof tx.walletId === 'string' ? tx.walletId : tx.walletId?.id));
        if (sourceWallet) {
          if (tx.type === 'expense') sourceWallet.balance += tx.amount;
          if (tx.type === 'income') sourceWallet.balance -= tx.amount;
          if (tx.type === 'transfer' && tx.destinationWalletId) {
            sourceWallet.balance += tx.amount;
            const destId = typeof tx.destinationWalletId === 'string' ? tx.destinationWalletId : tx.destinationWalletId.id;
            const destWallet = wallets.find((w: { id: string }) => w.id === destId);
            if (destWallet) destWallet.balance -= tx.amount;
          }
          await AsyncStorage.setItem(LOCAL_WALLETS_KEY, JSON.stringify(wallets));
        }
        transactions = transactions.filter((t) => t._id !== id);
        await AsyncStorage.setItem(LOCAL_TX_KEY, JSON.stringify(transactions));
      }
      return { success: true, message: 'Đã xóa giao dịch và hoàn tác số dư (offline)!' };
    }
  },

  /**
   * Lấy tổng kết dòng tiền (Tiền vào, Tiền ra, Dòng tiền ròng)
   */
  async getSummary(token?: string, month?: string): Promise<{ success: boolean; data: CashFlowSummary }> {
    try {
      const qs = month ? `?month=${month}` : '';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE_URL}/summary${qs}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch {
      // Offline fallback
      const raw = await AsyncStorage.getItem(LOCAL_TX_KEY);
      const items: TransactionItem[] = raw ? JSON.parse(raw) : [];
      let totalIncome = 0;
      let totalExpense = 0;

      items.forEach((t) => {
        if (!month || (t.transactionDate || '').startsWith(month)) {
          if (t.type === 'income') totalIncome += t.amount;
          if (t.type === 'expense') totalExpense += t.amount;
        }
      });

      return {
        success: true,
        data: {
          totalIncome,
          totalExpense,
          netCashFlow: totalIncome - totalExpense,
        },
      };
    }
  },
};
