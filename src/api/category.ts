import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ROOT_API_URL } from './config';

export interface CategoryItemData {
  id: string;
  _id?: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  isDefault?: boolean;
}

const API_BASE_URL = `${ROOT_API_URL}/categories`;
const LOCAL_CATEGORIES_KEY = '@financeflow_local_categories';

export const categoryApi = {
  async getCategories(token?: string, type?: 'expense' | 'income') {
    try {
      const qs = new URLSearchParams();
      if (type) qs.append('type', type);

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
      const raw = await AsyncStorage.getItem(LOCAL_CATEGORIES_KEY);
      let list: CategoryItemData[] = raw ? JSON.parse(raw) : [
        { id: 'cat_food', name: 'Ăn uống', type: 'expense', icon: 'utensils', color: '#EF4444' },
        { id: 'cat_shop', name: 'Mua sắm', type: 'expense', icon: 'shopping-bag', color: '#3B82F6' },
        { id: 'cat_trans', name: 'Di chuyển', type: 'expense', icon: 'car', color: '#10B981' },
        { id: 'cat_ent', name: 'Giải trí', type: 'expense', icon: 'film', color: '#8B5CF6' },
        { id: 'cat_other', name: 'Khác', type: 'expense', icon: 'more-horizontal', color: '#6B7280' },
        { id: 'cat_salary', name: 'Lương', type: 'income', icon: 'dollar-sign', color: '#10B981' },
        { id: 'cat_bonus', name: 'Thưởng', type: 'income', icon: 'gift', color: '#F59E0B' },
      ];
      if (type) {
        list = list.filter((c) => c.type === type);
      }
      return { success: true, data: list };
    }
  },
};
