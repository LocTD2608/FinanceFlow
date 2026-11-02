import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ROOT_API_URL } from './config';
import { User, LOCAL_USERS_KEY } from './auth';

export interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  adminUsers: number;
  regularUsers: number;
  totalTransactions: number;
  totalDefaultCategories: number;
}

export interface SystemCategory {
  _id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  isDefault: boolean;
}

export interface AdminUsersResponse {
  success: boolean;
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
}

const API_BASE_URL = `${ROOT_API_URL}/admin`;
const LOCAL_CATEGORIES_KEY = '@financeflow_local_categories';

// Danh sách danh mục mẫu ban đầu khi offline
const DEFAULT_INITIAL_CATEGORIES: SystemCategory[] = [
  { _id: 'sys_cat_1', name: 'Ăn uống', type: 'expense', icon: 'utensils', color: '#EF4444', isDefault: true },
  { _id: 'sys_cat_2', name: 'Đi lại', type: 'expense', icon: 'car', color: '#F97316', isDefault: true },
  { _id: 'sys_cat_3', name: 'Mua sắm', type: 'expense', icon: 'shopping-bag', color: '#EC4899', isDefault: true },
  { _id: 'sys_cat_4', name: 'Hóa đơn & Tiện ích', type: 'expense', icon: 'receipt', color: '#3B82F6', isDefault: true },
  { _id: 'sys_cat_5', name: 'Lương', type: 'income', icon: 'dollar-sign', color: '#10B981', isDefault: true },
  { _id: 'sys_cat_6', name: 'Thưởng', type: 'income', icon: 'gift', color: '#06B6D4', isDefault: true },
  { _id: 'sys_cat_7', name: 'Đầu tư sinh lời', type: 'income', icon: 'trending-up', color: '#8B5CF6', isDefault: true },
];

export const adminApi = {
  /**
   * 1. Lấy dữ liệu thống kê tổng quan hệ thống
   */
  async getMetrics(token: string | null): Promise<{ success: boolean; metrics: AdminMetrics }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE_URL}/metrics`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success && data.metrics) return data;
      throw new Error(data.message || 'Lỗi lấy metrics');
    } catch {
      // Offline fallback: Đọc từ AsyncStorage
      const rawUsers = await AsyncStorage.getItem(LOCAL_USERS_KEY);
      let users: User[] = rawUsers ? JSON.parse(rawUsers) : [];
      if (users.length === 0) {
        users = [
          { id: 'u_admin_999', username: 'Admin FinanceFlow', email: 'admin@financeflow.vn', role: 'admin', status: 'active', phone: '0988888888' },
          { id: 'u_demo_123', username: 'Nguyễn Demo', email: 'demo@financeflow.vn', role: 'user', status: 'active', phone: '0901234567' },
          { id: 'u_locked_777', username: 'Tài Khoản Bị Khóa', email: 'locked@financeflow.vn', role: 'user', status: 'locked', phone: '0911222333' },
        ];
        await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
      }

      const rawCategories = await AsyncStorage.getItem(LOCAL_CATEGORIES_KEY);
      const categories: SystemCategory[] = rawCategories ? JSON.parse(rawCategories) : DEFAULT_INITIAL_CATEGORIES;

      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.status !== 'locked').length;
      const lockedUsers = users.filter(u => u.status === 'locked').length;
      const adminUsers = users.filter(u => u.role === 'admin').length;
      const regularUsers = totalUsers - adminUsers;

      return {
        success: true,
        metrics: {
          totalUsers,
          activeUsers,
          lockedUsers,
          adminUsers,
          regularUsers,
          totalTransactions: 142,
          totalDefaultCategories: categories.length,
        },
      };
    }
  },

  /**
   * 2. Lấy danh sách người dùng
   */
  async getUsers(
    token: string | null,
    query?: { search?: string; role?: string; status?: string; page?: number; limit?: number }
  ): Promise<AdminUsersResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const params = new URLSearchParams();
      if (query?.search) params.append('search', query.search);
      if (query?.role) params.append('role', query.role);
      if (query?.status) params.append('status', query.status);
      if (query?.page) params.append('page', String(query.page));
      if (query?.limit) params.append('limit', String(query.limit));

      const res = await fetch(`${API_BASE_URL}/users?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success) return data;
      throw new Error(data.message || 'Lỗi lấy danh sách user');
    } catch {
      // Offline fallback: Đọc từ AsyncStorage
      const rawUsers = await AsyncStorage.getItem(LOCAL_USERS_KEY);
      let users: User[] = rawUsers ? JSON.parse(rawUsers) : [];
      if (users.length === 0) {
        users = [
          { id: 'u_admin_999', username: 'Admin FinanceFlow', email: 'admin@financeflow.vn', role: 'admin', status: 'active', phone: '0988888888' },
          { id: 'u_demo_123', username: 'Nguyễn Demo', email: 'demo@financeflow.vn', role: 'user', status: 'active', phone: '0901234567' },
          { id: 'u_locked_777', username: 'Tài Khoản Bị Khóa', email: 'locked@financeflow.vn', role: 'user', status: 'locked', phone: '0911222333' },
          { id: 'u_user_888', username: 'Trần Văn Bình', email: 'binh.tran@gmail.com', role: 'user', status: 'active', phone: '0933444555' },
        ];
        await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
      }

      let filtered = [...users];
      if (query?.search && query.search.trim()) {
        const q = query.search.trim().toLowerCase();
        filtered = filtered.filter(
          u =>
            u.email?.toLowerCase().includes(q) ||
            u.username?.toLowerCase().includes(q) ||
            u.phone?.toLowerCase().includes(q)
        );
      }
      if (query?.role && query.role !== 'all') {
        filtered = filtered.filter(u => u.role === query.role);
      }
      if (query?.status && query.status !== 'all') {
        filtered = filtered.filter(u => u.status === query.status);
      }

      return {
        success: true,
        users: filtered,
        pagination: {
          total: filtered.length,
          page: 1,
          limit: 50,
          totalPages: 1,
        },
      };
    }
  },

  /**
   * 3. Khóa / Mở khóa tài khoản
   */
  async updateUserStatus(token: string | null, userId: string, status: 'active' | 'locked'): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      return data;
    } catch {
      // Offline fallback: Cập nhật trong AsyncStorage
      const rawUsers = await AsyncStorage.getItem(LOCAL_USERS_KEY);
      const users: User[] = rawUsers ? JSON.parse(rawUsers) : [];
      let updatedUser: User | undefined;
      const newUsers = users.map(u => {
        if (u.id === userId || (u as any)._id === userId) {
          updatedUser = { ...u, status };
          return updatedUser;
        }
        return u;
      });
      await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(newUsers));
      return {
        success: true,
        message: status === 'locked' ? 'Đã khóa tài khoản thành công.' : 'Đã mở khóa tài khoản thành công.',
        user: updatedUser,
      };
    }
  },

  /**
   * 4. Nâng / Hạ quyền (Role toggle)
   */
  async updateUserRole(token: string | null, userId: string, role: 'user' | 'admin'): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      return data;
    } catch {
      // Offline fallback: Cập nhật trong AsyncStorage
      const rawUsers = await AsyncStorage.getItem(LOCAL_USERS_KEY);
      const users: User[] = rawUsers ? JSON.parse(rawUsers) : [];
      let updatedUser: User | undefined;
      const newUsers = users.map(u => {
        if (u.id === userId || (u as any)._id === userId) {
          updatedUser = { ...u, role };
          return updatedUser;
        }
        return u;
      });
      await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(newUsers));
      return {
        success: true,
        message: role === 'admin' ? 'Đã cấp quyền Quản trị viên!' : 'Đã chuyển về quyền Người dùng.',
        user: updatedUser,
      };
    }
  },

  /**
   * 5. Lấy danh sách danh mục hệ thống
   */
  async getCategories(token: string | null): Promise<{ success: boolean; categories: SystemCategory[] }> {
    try {
      const res = await fetch(`${ROOT_API_URL}/categories?isDefault=true`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      const data = await res.json();
      if (data.success && data.categories) return data;
      throw new Error(data.message || 'Lỗi');
    } catch {
      const raw = await AsyncStorage.getItem(LOCAL_CATEGORIES_KEY);
      const categories: SystemCategory[] = raw ? JSON.parse(raw) : DEFAULT_INITIAL_CATEGORIES;
      return { success: true, categories };
    }
  },

  /**
   * 6. Thêm danh mục hệ thống mặc định
   */
  async createCategory(
    token: string | null,
    data: { name: string; type: 'expense' | 'income'; icon: string; color: string }
  ): Promise<{ success: boolean; message: string; category?: SystemCategory }> {
    try {
      const res = await fetch(`${API_BASE_URL}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch {
      const raw = await AsyncStorage.getItem(LOCAL_CATEGORIES_KEY);
      const categories: SystemCategory[] = raw ? JSON.parse(raw) : [...DEFAULT_INITIAL_CATEGORIES];
      const newCat: SystemCategory = {
        _id: `sys_cat_${Date.now()}`,
        name: data.name,
        type: data.type,
        icon: data.icon,
        color: data.color,
        isDefault: true,
      };
      categories.push(newCat);
      await AsyncStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(categories));
      return { success: true, message: 'Đã tạo danh mục hệ thống thành công!', category: newCat };
    }
  },

  /**
   * 7. Xóa danh mục hệ thống
   */
  async deleteCategory(token: string | null, id: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      return await res.json();
    } catch {
      const raw = await AsyncStorage.getItem(LOCAL_CATEGORIES_KEY);
      const categories: SystemCategory[] = raw ? JSON.parse(raw) : [...DEFAULT_INITIAL_CATEGORIES];
      const filtered = categories.filter(c => c._id !== id);
      await AsyncStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(filtered));
      return { success: true, message: 'Đã xóa danh mục hệ thống.' };
    }
  },
};
