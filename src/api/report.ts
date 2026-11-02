import { API_BASE_URL as ROOT_API_URL } from './config';

export interface DailySeriesItem {
  date: string;
  day: number;
  amount: number;
}

export interface DailyRecordItem {
  _id: string;
  amount: number;
  type: 'expense' | 'income';
  transactionDate: string;
  note?: string;
  categoryId?: {
    _id: string;
    name: string;
    icon: string;
    color: string;
    type: string;
  };
  walletId?: {
    _id: string;
    name: string;
    type: string;
    currency: string;
  };
}

export interface DayDetailItem {
  date: string;
  day: number;
  amount: number;
  records: DailyRecordItem[];
}

export interface DailyReportData {
  month: string;
  type: 'expense' | 'income' | 'all';
  total: number;
  average: number;
  max: {
    date: string;
    amount: number;
  };
  totalDays: number;
  series: DailySeriesItem[];
  days: DayDetailItem[];
}

const API_BASE_URL = `${ROOT_API_URL}/reports`;

export const reportApi = {
  /**
   * GET /api/reports/daily?month=YYYY-MM&type=expense|income|all
   */
  async getDailyReport(
    token?: string,
    query?: { month?: string; type?: 'expense' | 'income' | 'all' }
  ): Promise<{ success: boolean; data?: DailyReportData; message?: string }> {
    try {
      const qs = new URLSearchParams();
      if (query?.month) qs.append('month', query.month);
      if (query?.type) qs.append('type', query.type);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${API_BASE_URL}/daily?${qs.toString()}`, {
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
