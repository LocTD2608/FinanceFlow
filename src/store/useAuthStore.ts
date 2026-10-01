import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null, token: string | null) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

const AUTH_STORAGE_KEY = '@financeflow_auth_session';

export const useAuthStore = create<AuthState>((set) => ({
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
