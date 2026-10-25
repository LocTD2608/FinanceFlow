import { create } from 'zustand';
import {
  transactionApi,
  TransactionItem,
  CreateTransactionInput,
  CashFlowSummary,
} from '../api/transaction';

interface TransactionState {
  transactions: TransactionItem[];
  summary: CashFlowSummary;
  isLoading: boolean;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  fetchTransactions: (token?: string, month?: string) => Promise<void>;
  fetchSummary: (token?: string, month?: string) => Promise<void>;
  createTransaction: (token: string | undefined, input: CreateTransactionInput) => Promise<{ success: boolean; message: string }>;
  deleteTransaction: (token: string | undefined, id: string) => Promise<{ success: boolean; message: string }>;
}

const getCurrentMonthString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  summary: { totalIncome: 0, totalExpense: 0, netCashFlow: 0 },
  isLoading: false,
  selectedMonth: getCurrentMonthString(),

  setSelectedMonth: (month: string) => {
    set({ selectedMonth: month });
  },

  fetchTransactions: async (token?: string, month?: string) => {
    set({ isLoading: true });
    try {
      const targetMonth = month || get().selectedMonth;
      const res = await transactionApi.getTransactions(token, { month: targetMonth });
      if (res.success && res.data) {
        set({ transactions: res.data });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSummary: async (token?: string, month?: string) => {
    try {
      const targetMonth = month || get().selectedMonth;
      const res = await transactionApi.getSummary(token, targetMonth);
      if (res.success && res.data) {
        set({ summary: res.data });
      }
    } catch {
      // keep current summary
    }
  },

  createTransaction: async (token: string | undefined, input: CreateTransactionInput) => {
    set({ isLoading: true });
    try {
      const res = await transactionApi.createTransaction(token, input);
      if (res.success) {
        // Cập nhật lại danh sách & thống kê
        await get().fetchTransactions(token);
        await get().fetchSummary(token);
        return { success: true, message: res.message || 'Tạo giao dịch thành công!' };
      }
      return { success: false, message: res.message || 'Không thể tạo giao dịch.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Lỗi kết nối khi tạo giao dịch.' };
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTransaction: async (token: string | undefined, id: string) => {
    set({ isLoading: true });
    try {
      const res = await transactionApi.deleteTransaction(token, id);
      if (res.success) {
        await get().fetchTransactions(token);
        await get().fetchSummary(token);
        return { success: true, message: res.message || 'Xóa giao dịch thành công!' };
      }
      return { success: false, message: res.message || 'Không thể xóa giao dịch.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Lỗi khi xóa giao dịch.' };
    } finally {
      set({ isLoading: false });
    }
  },
}));
