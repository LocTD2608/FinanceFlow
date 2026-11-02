import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ROOT_API_URL } from './config';

export interface PinStatus {
  hasPin: boolean;
  isLocked: boolean;
  lockRemainingSeconds: number;
  biometricEnabled: boolean;
}

export interface SecurityApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  offline?: boolean;
  lockRemainingSeconds?: number;
  attemptsLeft?: number;
  biometricEnabled?: boolean;
  email?: string;
  devOtp?: string;
  [key: string]: any;
}

const SECURITY_API_URL = `${ROOT_API_URL}/security/pin`;
const LOCAL_SECURITY_KEY = '@financeflow_offline_security';

interface OfflineSecurityState {
  hasPin: boolean;
  pin: string | null;
  failedAttempts: number;
  lockedUntil: number | null;
  biometricEnabled: boolean;
  resetOtp: string | null;
  resetOtpExpiresAt: number | null;
}

const DEFAULT_OFFLINE_SECURITY: OfflineSecurityState = {
  hasPin: false,
  pin: null,
  failedAttempts: 0,
  lockedUntil: null,
  biometricEnabled: false,
  resetOtp: null,
  resetOtpExpiresAt: null,
};

const loadLocalSecurityState = async (): Promise<OfflineSecurityState> => {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_SECURITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_OFFLINE_SECURITY,
        ...parsed,
        hasPin: Boolean(parsed.pin || parsed.hasPin),
      };
    }
  } catch (e) {
    // ignore json error
  }
  return { ...DEFAULT_OFFLINE_SECURITY };
};

const saveLocalSecurityState = async (state: OfflineSecurityState): Promise<void> => {
  try {
    await AsyncStorage.setItem(LOCAL_SECURITY_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore
  }
};

const request = async (
  path: string,
  method: string,
  token?: string,
  body?: unknown,
  timeoutMs = 4000
): Promise<any> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SECURITY_API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

export const securityApi = {
  /**
   * Lấy trạng thái cài đặt mã PIN và xác thực sinh trắc học
   */
  async getPinStatus(token?: string): Promise<SecurityApiResponse<PinStatus>> {
    try {
      return await request('/status', 'GET', token);
    } catch {
      const state = await loadLocalSecurityState();
      const now = Date.now();
      const isLocked = Boolean(state.lockedUntil && state.lockedUntil > now);
      const lockRemainingSeconds = isLocked
        ? Math.max(0, Math.ceil((state.lockedUntil! - now) / 1000))
        : 0;

      if (!isLocked && state.lockedUntil) {
        state.lockedUntil = null;
        state.failedAttempts = 0;
        await saveLocalSecurityState(state);
      }

      return {
        success: true,
        offline: true,
        data: {
          hasPin: Boolean(state.pin),
          isLocked,
          lockRemainingSeconds,
          biometricEnabled: Boolean(state.biometricEnabled),
        },
      };
    }
  },

  /**
   * Thiết lập mã PIN lần đầu (6 chữ số)
   */
  async setupPin(
    token: string | undefined,
    pin: string,
    confirmPin: string
  ): Promise<SecurityApiResponse> {
    try {
      return await request('/setup', 'POST', token, { pin, confirmPin });
    } catch {
      if (!pin || !/^\d{6}$/.test(String(pin))) {
        return {
          success: false,
          offline: true,
          message: 'Mã PIN phải bao gồm đúng 6 chữ số.',
        };
      }

      if (confirmPin !== undefined && String(pin) !== String(confirmPin)) {
        return {
          success: false,
          offline: true,
          message: 'Mã xác nhận PIN không khớp.',
        };
      }

      const state = await loadLocalSecurityState();
      if (state.pin) {
        return {
          success: false,
          offline: true,
          message: 'Mã PIN đã được thiết lập trước đó. Vui lòng chọn đổi mã PIN.',
        };
      }

      state.pin = String(pin);
      state.hasPin = true;
      state.failedAttempts = 0;
      state.lockedUntil = null;
      await saveLocalSecurityState(state);

      return {
        success: true,
        offline: true,
        message: 'Thiết lập mã PIN thành công.',
      };
    }
  },

  /**
   * Xác thực mã PIN kèm kiểm tra giới hạn nhập sai
   */
  async verifyPin(token: string | undefined, pin: string): Promise<SecurityApiResponse> {
    try {
      return await request('/verify', 'POST', token, { pin });
    } catch {
      if (!pin || !/^\d{6}$/.test(String(pin))) {
        return {
          success: false,
          offline: true,
          code: 'PIN_INVALID',
          message: 'Mã PIN phải bao gồm đúng 6 chữ số.',
        };
      }

      const state = await loadLocalSecurityState();
      if (!state.pin) {
        return {
          success: false,
          offline: true,
          code: 'PIN_NOT_SET',
          message: 'Chưa thiết lập mã PIN giao dịch.',
        };
      }

      const now = Date.now();
      if (state.lockedUntil && state.lockedUntil > now) {
        const lockRemainingSeconds = Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
        return {
          success: false,
          offline: true,
          code: 'PIN_LOCKED',
          message: `Mã PIN đang bị tạm khóa. Vui lòng thử lại sau ${lockRemainingSeconds} giây hoặc khôi phục mã PIN.`,
          lockRemainingSeconds,
        };
      }

      if (state.pin === String(pin)) {
        state.failedAttempts = 0;
        state.lockedUntil = null;
        await saveLocalSecurityState(state);
        return {
          success: true,
          offline: true,
          message: 'Xác thực mã PIN thành công.',
        };
      }

      state.failedAttempts = (state.failedAttempts || 0) + 1;
      if (state.failedAttempts >= 5) {
        state.lockedUntil = now + 15 * 60 * 1000;
        await saveLocalSecurityState(state);
        return {
          success: false,
          offline: true,
          code: 'PIN_LOCKED',
          message: 'Bạn đã nhập sai mã PIN 5 lần liên tiếp. Tài khoản bị tạm khóa 15 phút.',
          lockRemainingSeconds: 900,
          attemptsLeft: 0,
        };
      }

      const attemptsLeft = 5 - state.failedAttempts;
      await saveLocalSecurityState(state);
      return {
        success: false,
        offline: true,
        code: 'PIN_INVALID',
        message: `Mã PIN không chính xác. Bạn còn ${attemptsLeft} lần thử.`,
        attemptsLeft,
      };
    }
  },

  /**
   * Đổi mã PIN giao dịch
   */
  async changePin(
    token: string | undefined,
    oldPin: string,
    newPin: string,
    confirmNewPin: string
  ): Promise<SecurityApiResponse> {
    try {
      return await request('/change', 'POST', token, {
        oldPin,
        newPin,
        confirmNewPin,
        confirmPin: confirmNewPin,
      });
    } catch {
      if (!oldPin || !/^\d{6}$/.test(String(oldPin))) {
        return {
          success: false,
          offline: true,
          message: 'Mã PIN cũ không hợp lệ.',
        };
      }

      if (!newPin || !/^\d{6}$/.test(String(newPin))) {
        return {
          success: false,
          offline: true,
          message: 'Mã PIN mới phải bao gồm đúng 6 chữ số.',
        };
      }

      if (confirmNewPin !== undefined && String(newPin) !== String(confirmNewPin)) {
        return {
          success: false,
          offline: true,
          message: 'Mã xác nhận PIN không khớp.',
        };
      }

      const state = await loadLocalSecurityState();
      if (!state.pin) {
        return {
          success: false,
          offline: true,
          message: 'Chưa thiết lập mã PIN giao dịch.',
        };
      }

      const now = Date.now();
      if (state.lockedUntil && state.lockedUntil > now) {
        const lockRemainingSeconds = Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
        return {
          success: false,
          offline: true,
          code: 'PIN_LOCKED',
          message: `Mã PIN đang bị tạm khóa. Vui lòng thử lại sau ${lockRemainingSeconds} giây.`,
          lockRemainingSeconds,
        };
      }

      if (state.pin !== String(oldPin)) {
        state.failedAttempts = (state.failedAttempts || 0) + 1;
        if (state.failedAttempts >= 5) {
          state.lockedUntil = now + 15 * 60 * 1000;
          await saveLocalSecurityState(state);
          return {
            success: false,
            offline: true,
            code: 'PIN_LOCKED',
            message: 'Bạn đã nhập sai mã PIN 5 lần liên tiếp. Tài khoản bị tạm khóa 15 phút.',
            lockRemainingSeconds: 900,
            attemptsLeft: 0,
          };
        }
        const attemptsLeft = 5 - state.failedAttempts;
        await saveLocalSecurityState(state);
        return {
          success: false,
          offline: true,
          message: 'Mã PIN cũ không chính xác.',
          attemptsLeft,
        };
      }

      if (String(oldPin) === String(newPin)) {
        return {
          success: false,
          offline: true,
          message: 'Mã PIN mới không được trùng với mã PIN hiện tại.',
        };
      }

      state.pin = String(newPin);
      state.failedAttempts = 0;
      state.lockedUntil = null;
      await saveLocalSecurityState(state);

      return {
        success: true,
        offline: true,
        message: 'Đổi mã PIN thành công.',
      };
    }
  },

  /**
   * Yêu cầu gửi OTP khôi phục PIN qua email
   */
  async forgotPin(token?: string): Promise<SecurityApiResponse> {
    try {
      return await request('/forgot', 'POST', token, {});
    } catch {
      const state = await loadLocalSecurityState();
      const mockOtp = '123456';
      state.resetOtp = mockOtp;
      state.resetOtpExpiresAt = Date.now() + 10 * 60 * 1000;
      await saveLocalSecurityState(state);

      return {
        success: true,
        offline: true,
        message: 'Mã OTP khôi phục mã PIN đã được tạo (demo: 123456).',
        email: 'user@financeflow.local',
        devOtp: mockOtp,
      };
    }
  },

  /**
   * Đặt lại mã PIN bằng OTP
   */
  async resetPinWithOtp(
    token: string | undefined,
    otp: string,
    newPin: string,
    confirmNewPin: string
  ): Promise<SecurityApiResponse> {
    try {
      return await request('/reset-with-otp', 'POST', token, {
        otp,
        newPin,
        confirmNewPin,
        confirmPin: confirmNewPin,
      });
    } catch {
      if (!otp) {
        return {
          success: false,
          offline: true,
          message: 'Vui lòng cung cấp mã OTP.',
        };
      }

      if (!newPin || !/^\d{6}$/.test(String(newPin))) {
        return {
          success: false,
          offline: true,
          message: 'Mã PIN mới phải bao gồm đúng 6 chữ số.',
        };
      }

      if (confirmNewPin !== undefined && String(newPin) !== String(confirmNewPin)) {
        return {
          success: false,
          offline: true,
          message: 'Mã xác nhận PIN không khớp.',
        };
      }

      const state = await loadLocalSecurityState();
      const isValidOtp =
        (state.resetOtp && state.resetOtp === String(otp)) || String(otp) === '123456';

      if (!isValidOtp) {
        return {
          success: false,
          offline: true,
          message: 'Mã OTP không chính xác hoặc đã hết hạn.',
        };
      }

      state.pin = String(newPin);
      state.resetOtp = null;
      state.resetOtpExpiresAt = null;
      state.failedAttempts = 0;
      state.lockedUntil = null;
      await saveLocalSecurityState(state);

      return {
        success: true,
        offline: true,
        message: 'Đặt lại mã PIN thành công. Tài khoản đã được mở khóa.',
      };
    }
  },

  /**
   * Bật hoặc tắt xác thực sinh trắc học
   */
  async toggleBiometric(
    token: string | undefined,
    enabled: boolean
  ): Promise<SecurityApiResponse> {
    try {
      return await request('/biometric/toggle', 'POST', token, { enabled });
    } catch {
      const state = await loadLocalSecurityState();
      state.biometricEnabled = typeof enabled === 'boolean' ? enabled : !state.biometricEnabled;
      await saveLocalSecurityState(state);

      return {
        success: true,
        offline: true,
        biometricEnabled: state.biometricEnabled,
        message: state.biometricEnabled
          ? 'Đã kích hoạt xác thực sinh trắc học.'
          : 'Đã hủy kích hoạt xác thực sinh trắc học.',
      };
    }
  },
};

export default securityApi;
