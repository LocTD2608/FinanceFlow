import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../api/config';

const PUSH_TOKEN_KEY = '@financeflow_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Xin quyền, lấy Expo push token và đăng ký lên server. Chỉ chạy trên thiết bị thật.
 * Trả về token, hoặc null nếu không hỗ trợ / bị từ chối. Không bao giờ ném lỗi.
 */
export const registerForPushNotifications = async (authToken?: string | null): Promise<string | null> => {
  try {
    if (!authToken || !Device.isDevice) return null; // máy ảo không nhận được push

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('bill-reminders', {
        name: 'Nhắc hóa đơn',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

    const res = await fetch(`${API_BASE_URL}/auth/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token: pushToken, platform: Platform.OS }),
    });
    if ((await res.json()).success) await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
    return pushToken;
  } catch {
    return null;
  }
};

/** Hủy đăng ký token của thiết bị này (gọi trước khi đăng xuất). */
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
    // bỏ qua: token hỏng sẽ được server tự dọn khi gửi thất bại
  }
};
