import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  soundEnabled: boolean;
  toastEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setToastEnabled: (enabled: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
}

const SETTINGS_STORAGE_KEY = '@financeflow_app_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  soundEnabled: true,
  toastEnabled: true,

  setSoundEnabled: async (enabled: boolean) => {
    set({ soundEnabled: enabled });
    const { toastEnabled } = get();
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ soundEnabled: enabled, toastEnabled }));
  },

  setToastEnabled: async (enabled: boolean) => {
    set({ toastEnabled: enabled });
    const { soundEnabled } = get();
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ soundEnabled, toastEnabled: enabled }));
  },

  loadSettings: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          soundEnabled: data.soundEnabled !== undefined ? data.soundEnabled : true,
          toastEnabled: data.toastEnabled !== undefined ? data.toastEnabled : true,
        });
      }
    } catch {
      // Ignore
    }
  },
}));
