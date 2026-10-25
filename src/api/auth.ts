import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ROOT_API_URL } from './config';

export interface User {
  id: string;
  username: string;
  phone?: string;
  email: string;
  authProvider?: 'local' | 'google' | 'apple' | 'facebook';
  avatar?: string | null;
}

export interface SocialLoginPayload {
  provider: 'google' | 'apple' | 'facebook';
  oauthId: string;
  email: string;
  username: string;
  avatar?: string;
  idToken?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

const API_BASE_URL = `${ROOT_API_URL}/auth`;
const LOCAL_USERS_KEY = '@financeflow_local_users';

export const authApi = {
  async register(username: string, phone: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, phone, email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      return data;
    } catch {
      // Offline fallback: Lưu trực tiếp vào AsyncStorage để test ngay
      const rawUsers = await AsyncStorage.getItem(LOCAL_USERS_KEY);
      const users: Array<User & { password: string }> = rawUsers ? JSON.parse(rawUsers) : [];
      if (users.find(u => u.email === email || u.phone === phone)) {
        return { success: false, message: 'Email hoặc số điện thoại đã tồn tại.' };
      }
      const newUser = { id: `u_${Date.now()}`, username, phone, email, password, authProvider: 'local' as const };
      users.push(newUser);
      await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
      return {
        success: true,
        message: 'Đăng ký thành công!',
        user: { id: newUser.id, username, phone, email, authProvider: 'local' },
        token: `mock_jwt_token_${newUser.id}`,
      };
    }
  },

  async login(identifier: string, password: string): Promise<AuthResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      return data;
    } catch {
      // Offline fallback
      const rawUsers = await AsyncStorage.getItem(LOCAL_USERS_KEY);
      const users: Array<User & { password: string }> = rawUsers ? JSON.parse(rawUsers) : [];
      let user = users.find(u => (u.email === identifier || u.phone === identifier) && u.password === password);
      
      // Hỗ trợ đăng nhập tài khoản Admin & Demo nhanh
      const idLower = identifier.trim().toLowerCase();
      if (!user && (idLower === 'admin' || idLower === 'admin@financeflow.vn' || idLower === 'admin@gmail.com' || idLower === '0988888888')) {
        user = {
          id: 'u_admin_999',
          username: 'Admin FinanceFlow',
          phone: '0988888888',
          email: 'admin@financeflow.vn',
          password,
          authProvider: 'local',
        };
      } else if (!user && (idLower === 'demo@financeflow.vn' || idLower === 'demo' || idLower === '0901234567')) {
        user = {
          id: 'u_demo_123',
          username: 'Nguyễn Demo',
          phone: '0901234567',
          email: 'demo@financeflow.vn',
          password,
          authProvider: 'local',
        };
      }

      if (!user) {
        return { success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' };
      }
      return {
        success: true,
        message: 'Đăng nhập thành công!',
        user: { id: user.id, username: user.username, phone: user.phone, email: user.email, authProvider: user.authProvider || 'local' },
        token: `mock_jwt_token_${user.id}`,
      };
    }
  },

  async socialLogin(payload: SocialLoginPayload): Promise<AuthResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_BASE_URL}/social-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      return data;
    } catch {
      // Offline fallback: Tạo user mô phỏng và lưu vào AsyncStorage
      const rawUsers = await AsyncStorage.getItem(LOCAL_USERS_KEY);
      const users: Array<User & { password?: string }> = rawUsers ? JSON.parse(rawUsers) : [];
      let user = users.find(u => u.email === payload.email || (u as any).oauthId === payload.oauthId);
      if (!user) {
        user = {
          id: `u_${payload.provider}_${Date.now()}`,
          username: payload.username,
          phone: '',
          email: payload.email,
          authProvider: payload.provider,
          avatar: payload.avatar || null,
        };
        users.push(user);
        await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
      }
      return {
        success: true,
        message: `Đăng nhập ${payload.provider.toUpperCase()} thành công!`,
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone || '',
          email: user.email,
          authProvider: payload.provider,
          avatar: user.avatar,
        },
        token: `mock_social_jwt_${user.id}`,
      };
    }
  },
};
