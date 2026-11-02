import { API_BASE_URL as ROOT_API_URL } from './config';

export interface CategoryBreakdownItem {
  rank: number;
  categoryId: string | null;
  name: string;
  icon: string;
  color: string;
  amount: number;
  percent: number;
  transactionCount: number;
}

export interface BreakdownResponse {
  type: 'expense' | 'income';
  period: 'day' | 'week' | 'month' | 'year';
  from: string;
  to: string;
  total: number;
  items: CategoryBreakdownItem[];
}

export interface OverviewResponse {
  period: 'day' | 'month';
  from: string;
  to: string;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  balance: number;
  comparison: {
    prevIncome: number;
    prevExpense: number;
    incomeChangePercent: number | null;
    expenseChangePercent: number | null;
  };
  topCategories: Array<{
    categoryId: string | null;
    name: string;
    icon: string;
    color: string;
    amount: number;
    percent: number;
    transactionCount: number;
  }>;
  recentTransactions: any[];
  transactionCount: number;
}

const API_BASE_URL = `${ROOT_API_URL}/dashboard`;

export const dashboardApi = {
  /**
   * GET /api/dashboard/breakdown?type=expense|income&period=month|day&date=YYYY-MM-DD
   */
  async getBreakdown(
    token?: string,
    query?: { type?: 'expense' | 'income'; period?: 'day' | 'week' | 'month' | 'year'; date?: string }
  ): Promise<{ success: boolean; data?: BreakdownResponse; message?: string }> {
    try {
      const qs = new URLSearchParams();
      if (query?.type) qs.append('type', query.type);
      if (query?.period) qs.append('period', query.period);
      if (query?.date) qs.append('date', query.date);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${API_BASE_URL}/breakdown?${qs.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      return json;
    } catch (err: any) {
      return { success: false, message: err?.message || 'Không thể kết nối máy chủ.' };
    }
  },

  /**
   * GET /api/dashboard/overview?period=day|month&date=YYYY-MM-DD
   */
  async getOverview(
    token?: string,
    query?: { period?: 'day' | 'month'; date?: string }
  ): Promise<{ success: boolean; data?: OverviewResponse; message?: string }> {
    try {
      const qs = new URLSearchParams();
      if (query?.period) qs.append('period', query.period);
      if (query?.date) qs.append('date', query.date);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${API_BASE_URL}/overview?${qs.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();
      return json;
    } catch (err: any) {
      return { success: false, message: err?.message || 'Không thể kết nối máy chủ.' };
    }
  },
};
