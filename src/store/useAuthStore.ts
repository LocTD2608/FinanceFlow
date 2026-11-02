import { useTransactionStore } from './useTransactionStore';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, authApi } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  activeMode: 'admin' | 'user';
  setUser: (user: User | null, token: string | null) => Promise<void>;
  setActiveMode: (mode: 'admin' | 'user') => void;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

const AUTH_STORAGE_KEY = '@financeflow_auth_session';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  activeMode: 'user',

  setUser: async (user, token) => {
    if (user && token) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
    const activeMode = user?.role === 'admin' ? 'admin' : 'user';
    set({ user, token, activeMode });
  },

  setActiveMode: (mode: 'admin' | 'user') => {
    set({ activeMode: mode });
  },

  updateProfile: async (data: Partial<User>) => {
    const { user, token } = get();
    try {
      const res = await authApi.updateProfile(token || undefined, {
        ...user,
        ...data,
      });
      if (res.success && res.user) {
        const mergedUser = { ...(user || {}), ...res.user } as User;
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: mergedUser, token }));
        set({ user: mergedUser });
        return { success: true, message: res.message || 'Cập nhật thành công!' };
      }
      return { success: false, message: res.message || 'Cập nhật thất bại.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Có lỗi xảy ra.' };
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    try { useTransactionStore.getState().reset(); } catch {}
    set({ user: null, token: null, activeMode: 'user' });
  },

  loadSession: async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const { user, token } = JSON.parse(raw);
        const activeMode = user?.role === 'admin' ? 'admin' : 'user';
        set({ user, token, activeMode, isLoading: false });
        return;
      }
    } catch {
      // ignore error
    }
    set({ isLoading: false, activeMode: 'user' });
  },
}));
