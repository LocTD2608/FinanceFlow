import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../api/config';

const PUSH_TOKEN_KEY = '@financeflow_push_token';

// Tải an toàn expo-notifications (tránh văng app trên Expo Go do thiếu native module)
let notificationsModule: typeof import('expo-notifications') | null = null;
try {
  notificationsModule = require('expo-notifications');
  if (notificationsModule && notificationsModule.setNotificationHandler) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (e) {
  // Expo Go trên Android không hỗ trợ native push module
  notificationsModule = null;
}

let deviceModule: typeof import('expo-device') | null = null;
try {
  deviceModule = require('expo-device');
} catch (e) {
  deviceModule = null;
}

let constantsModule: typeof import('expo-constants') | null = null;
try {
  constantsModule = require('expo-constants');
} catch (e) {
  constantsModule = null;
}

/**
 * Xin quyền, lấy Expo push token và đăng ký lên server.
 * Chạy an toàn: nếu trên Expo Go hoặc máy ảo thiếu module native thì bỏ qua, không gây crash app.
 */
export const registerForPushNotifications = async (authToken?: string | null): Promise<string | null> => {
  try {
    if (!authToken || !notificationsModule) return null;
    if (deviceModule && !deviceModule.isDevice) return null; // máy ảo không nhận push

    if (Platform.OS === 'android' && notificationsModule.setNotificationChannelAsync) {
      await notificationsModule.setNotificationChannelAsync('bill-reminders', {
        name: 'Nhắc hóa đơn',
        importance: notificationsModule.AndroidImportance.HIGH,
      });
    }

    const current = await notificationsModule.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      status = (await notificationsModule.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const Constants: any = constantsModule?.default || constantsModule;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    const tokenData = await notificationsModule.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenData?.data;
    if (!pushToken) return null;

    const res = await fetch(`${API_BASE_URL}/auth/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token: pushToken, platform: Platform.OS }),
    });
    if ((await res.json()).success) {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
    }
    return pushToken;
  } catch (err) {
    // Không ném lỗi ra ngoài làm crash app
    return null;
  }
};

/** Hủy đăng ký token của thiết bị này */
export const unregisterPushNotifications = async (authToken?: string | null): Promise<void> => {
  try {
    const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!pushToken || !authToken) return;
    await fetch(`${API_BASE_URL}/auth/push-token`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token: pushToken }),
    });
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // bỏ qua
  }
};
