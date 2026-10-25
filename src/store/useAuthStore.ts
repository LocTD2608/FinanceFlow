import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, authApi } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null, token: string | null) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

const AUTH_STORAGE_KEY = '@financeflow_auth_session';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,

  setUser: async (user, token) => {
    if (user && token) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
    set({ user, token });
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
    set({ user: null, token: null });
  },

  loadSession: async () => {
    try {
      const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const { user, token } = JSON.parse(raw);
        set({ user, token, isLoading: false });
        return;
      }
    } catch {
      // ignore error
    }
    set({ isLoading: false });
  },
}));
