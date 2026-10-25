import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Tự động xác định địa chỉ IP máy chủ API cho cả thiết bị thật (iOS/Android) và máy ảo
 */
export const getApiBaseUrl = (): string => {
  // 1. Thử lấy IP máy chủ phát triển từ Expo Metro Bundler (chạy được trên mọi điện thoại cùng Wi-Fi)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000/api`;
    }
  }

  // 2. Máy ảo Android (Android Emulator nối tới host qua 10.0.2.2)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  // 3. iPhone / Thiết bị thật chạy Wi-Fi cục bộ
  if (Platform.OS === 'ios') {
    return 'http://192.168.103.64:5000/api';
  }

  // 4. Web browser trên máy tính
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getApiBaseUrl();
