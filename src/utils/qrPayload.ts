/**
 * Tiện ích đóng gói và phân tích mã QR thanh toán chuẩn FinanceFlow
 */

export interface QRPayloadUser {
  id?: string;
  _id?: string;
  recipientId?: string;
  username: string;
  nickname?: string;
  phone?: string;
}

export interface QRPayloadData {
  app: 'FinanceFlow';
  version: string;
  type: 'P2P_RECEIVE';
  recipientId: string;
  username: string;
  nickname?: string;
  phone?: string;
  amount?: number;
  note?: string;
}

export interface QRPayloadResult {
  valid: boolean;
  data?: QRPayloadData;
  error?: string;
}

/**
 * Sinh chuỗi payload JSON chuẩn FinanceFlow để tạo mã QR
 * @param user Thông tin người nhận
 * @param amount Số tiền chuyển (nếu là QR động > 0; nếu = 0 hoặc bỏ trống sẽ là QR tĩnh)
 * @param note Nội dung chuyển tiền (tuỳ chọn)
 */
export const generateQRPayload = (
  user: QRPayloadUser,
  amount?: number,
  note?: string
): string => {
  const recipientId = user.recipientId || user.id || user._id || '';

  const payload: QRPayloadData = {
    app: 'FinanceFlow',
    version: '1.0',
    type: 'P2P_RECEIVE',
    recipientId,
    username: user.username || '',
  };

  if (user.nickname) {
    payload.nickname = user.nickname;
  }

  if (user.phone) {
    payload.phone = user.phone;
  }

  if (typeof amount === 'number' && amount > 0) {
    payload.amount = Math.round(amount);
  }

  if (note && typeof note === 'string' && note.trim().length > 0) {
    payload.note = note.trim();
  }

  return JSON.stringify(payload);
};

/**
 * Phân tích và xác thực chuỗi payload từ mã QR được quét
 * @param raw Chuỗi raw đọc từ camera hoặc thư viện quét QR
 */
export const parseQRPayload = (raw: string | unknown): QRPayloadResult => {
  if (!raw || typeof raw !== 'string') {
    return {
      valid: false,
      error: 'Dữ liệu mã QR trống hoặc không hợp lệ.',
    };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Dữ liệu mã QR trống.',
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      valid: false,
      error: 'Mã QR không đúng định dạng JSON hoặc không phải mã QR hợp lệ.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'Mã QR không chứa dữ liệu cấu trúc hợp lệ.',
    };
  }

  if (parsed.app !== 'FinanceFlow') {
    return {
      valid: false,
      error: 'Mã QR không thuộc hệ thống FinanceFlow.',
    };
  }

  if (parsed.type !== 'P2P_RECEIVE') {
    return {
      valid: false,
      error: 'Mã QR không phải giao dịch nhận tiền P2P.',
    };
  }

  const recipientId = parsed.recipientId || parsed.userId || parsed.id;
  if (!recipientId || typeof recipientId !== 'string' || !recipientId.trim()) {
    return {
      valid: false,
      error: 'Mã QR thiếu thông tin người nhận.',
    };
  }

  const data: QRPayloadData = {
    app: 'FinanceFlow',
    version: typeof parsed.version === 'string' ? parsed.version : '1.0',
    type: 'P2P_RECEIVE',
    recipientId: recipientId.trim(),
    username: typeof parsed.username === 'string' ? parsed.username.trim() : '',
  };

  if (parsed.nickname && typeof parsed.nickname === 'string') {
    data.nickname = parsed.nickname.trim();
  }

  if (parsed.phone && typeof parsed.phone === 'string') {
    data.phone = parsed.phone.trim();
  }

  if (typeof parsed.amount === 'number' && parsed.amount > 0) {
    data.amount = Math.round(parsed.amount);
  }

  if (parsed.note && typeof parsed.note === 'string' && parsed.note.trim()) {
    data.note = parsed.note.trim();
  }

  return {
    valid: true,
    data,
  };
};
