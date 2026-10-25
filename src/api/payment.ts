import { API_BASE_URL as ROOT_API_URL } from './config';

const BASE = `${ROOT_API_URL}/payments`;

export interface PaymentIntentInput {
  walletId: string;
  categoryId: string;
  amount: number;
  note?: string;
}

export interface PaymentResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string; // INSUFFICIENT_BALANCE | OTP_INVALID | OTP_EXPIRED | TOO_MANY_ATTEMPTS | NETWORK_ERROR
  [key: string]: any;
}

export const NETWORK_ERROR_SEND_OTP = 'Mất kết nối mạng, không thể gửi mã OTP. Vui lòng kiểm tra mạng và thử lại.';
export const NETWORK_ERROR_CONFIRM = 'Mất kết nối mạng, không thể xác nhận thanh toán. Vui lòng thử lại.';

/**
 * Gọi API thanh toán. KHÔNG có offline fallback: mất mạng thì trả code NETWORK_ERROR
 * để UI báo lỗi và giữ nguyên dữ liệu người dùng đã nhập.
 */
const call = async (path: string, token: string | undefined, body: unknown, networkMessage: string): Promise<PaymentResult> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // gửi mail có thể chậm
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return await res.json();
  } catch {
    return { success: false, code: 'NETWORK_ERROR', message: networkMessage };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const paymentApi = {
  /** Tạo yêu cầu thanh toán và gửi OTP qua email. data: { intentId, expiresAt, email (đã che) } */
  createIntent: (token: string | undefined, input: PaymentIntentInput) =>
    call('/intent', token, input, NETWORK_ERROR_SEND_OTP),

  resendOtp: (token: string | undefined, intentId: string) =>
    call(`/intent/${intentId}/resend`, token, {}, NETWORK_ERROR_SEND_OTP),

  /** Xác nhận OTP: đúng thì server trừ tiền và ghi giao dịch chi. */
  confirm: (token: string | undefined, intentId: string, otp: string) =>
    call(`/intent/${intentId}/confirm`, token, { otp }, NETWORK_ERROR_CONFIRM),
};
