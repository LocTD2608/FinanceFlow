import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ROOT_API_URL } from './config';

export interface BudgetCategoryRef {
  _id?: string;
  name: string;
  icon?: string;
  color?: string;
  type?: string;
}

export interface BudgetItem {
  _id: string;
  id?: string;
  userId: string;
  categoryId: string | BudgetCategoryRef;
  limitAmount: number;
  month: string;
  period: 'monthly' | 'salary_cycle';
  alertThreshold50?: boolean;
  alertThreshold80?: boolean;
  alertThreshold100?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBudgetInput {
  categoryId?: string;
  categoryName?: string;
  limitAmount: number;
  month?: string;
  period?: 'monthly' | 'salary_cycle';
  alertThreshold50?: boolean;
  alertThreshold80?: boolean;
  alertThreshold100?: boolean;
}

const API_BASE_URL = `${ROOT_API_URL}/budgets`;
const LOCAL_BUDGETS_KEY = '@financeflow_local_budgets';

export const budgetApi = {
  async getBudgets(token?: string, month?: string) {
    try {
      const qs = new URLSearchParams();
      if (month) qs.append('month', month);

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
      const raw = await AsyncStorage.getItem(LOCAL_BUDGETS_KEY);
      const items: BudgetItem[] = raw ? JSON.parse(raw) : [];
      let filtered = [...items];
      if (month) {
        filtered = filtered.filter((b) => b.month === month);
      }
      return { success: true, data: filtered };
    }
  },

  async createBudget(token: string | undefined, input: CreateBudgetInput) {
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
      const d = new Date();
      const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const newBudget: BudgetItem = {
        _id: `b_${Date.now()}`,
        userId: 'local_user',
        categoryId: {
          name: input.categoryName || 'Ăn uống',
        },
        limitAmount: input.limitAmount,
        month: input.month || currentMonth,
        period: input.period || 'monthly',
        alertThreshold50: input.alertThreshold50 !== undefined ? input.alertThreshold50 : true,
        alertThreshold80: input.alertThreshold80 !== undefined ? input.alertThreshold80 : true,
        alertThreshold100: input.alertThreshold100 !== undefined ? input.alertThreshold100 : true,
        createdAt: new Date().toISOString(),
      };

      const raw = await AsyncStorage.getItem(LOCAL_BUDGETS_KEY);
      const budgets: BudgetItem[] = raw ? JSON.parse(raw) : [];
      budgets.unshift(newBudget);
      await AsyncStorage.setItem(LOCAL_BUDGETS_KEY, JSON.stringify(budgets));

      return {
        success: true,
        message: 'Kích hoạt ngân sách thành công!',
        data: newBudget,
      };
    }
  },
};
