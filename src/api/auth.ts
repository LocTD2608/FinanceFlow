import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  username: string;
  phone: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

const API_BASE_URL = 'http://localhost:5000/api/auth';
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
      const newUser = { id: `u_${Date.now()}`, username, phone, email, password };
      users.push(newUser);
      await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
      return {
        success: true,
        message: 'Đăng ký thành công!',
        user: { id: newUser.id, username, phone, email },
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
      const user = users.find(u => (u.email === identifier || u.phone === identifier) && u.password === password);
      if (!user) {
        return { success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' };
      }
      return {
        success: true,
        message: 'Đăng nhập thành công!',
        user: { id: user.id, username: user.username, phone: user.phone, email: user.email },
        token: `mock_jwt_token_${user.id}`,
      };
    }
  },
};
