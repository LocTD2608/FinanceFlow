import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ROOT_API_URL } from './config';
import { securityApi } from './security';

export interface P2PRecipient {
  id: string;
  _id?: string;
  username: string;
  nickname?: string;
  phone?: string;
  email?: string;
  avatar?: string | null;
}

export interface P2PTransferInput {
  recipientId: string;
  amount: number;
  note?: string;
  pin: string;
  idempotencyKey?: string;
  walletId?: string;
  fromWalletId?: string;
  toAccountNumber?: string;
}

export interface P2PTransferResult {
  transactionId: string;
  amount: number;
  recipientName: string;
  newBalance: number;
}

export interface P2PApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  recipient?: P2PRecipient;
  code?: string;
  offline?: boolean;
  idempotent?: boolean;
  [key: string]: any;
}

const P2P_API_URL = `${ROOT_API_URL}/p2p`;
const LOCAL_WALLETS_KEY = '@financeflow_local_wallets';
const LOCAL_TX_KEY = '@financeflow_local_transactions';
const LOCAL_P2P_KEY = '@financeflow_local_p2p_transfers';

/**
 * Decode userId tu JWT token de tao key offline rieng biet theo tung user.
 */
const getUserIdFromToken = (token?: string): string => {
  if (!token) return 'local_user';
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 'local_user';
    let payloadStr: string;
    if (typeof atob === 'function') {
      payloadStr = atob(parts[1]);
    } else {
      payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
    }
    const payload = JSON.parse(payloadStr);
    return payload.id || payload.sub || payload.userId || 'local_user';
  } catch {
    return 'local_user';
  }
};

const MOCK_RECIPIENTS: P2PRecipient[] = [
  {
    id: 'rec_alice',
    _id: 'rec_alice',
    username: 'alice',
    nickname: 'Alice Nguyễn',
    phone: '0901234567',
    email: 'alice@financeflow.local',
    avatar: null,
  },
  {
    id: 'rec_bob',
    _id: 'rec_bob',
    username: 'bob',
    nickname: 'Bob Trần',
    phone: '0912345678',
    email: 'bob@financeflow.local',
    avatar: null,
  },
  {
    id: 'rec_demo',
    _id: 'rec_demo',
    username: 'demo_user',
    nickname: 'Demo Receiver',
    phone: '0988888888',
    email: 'demo@financeflow.local',
    avatar: null,
  },
];

const loadLocalWallets = async (token?: string): Promise<any[]> => {
  const key = `${LOCAL_WALLETS_KEY}_${getUserIdFromToken(token)}`;
  const raw = await AsyncStorage.getItem(key);
  return raw
    ? JSON.parse(raw)
    : [
        {
          _id: 'w_cash_default',
          id: 'w_cash_default',
          userId: getUserIdFromToken(token),
          name: 'Ví tiền mặt',
          type: 'cash',
          balance: 2500000,
          currency: 'VND',
        },
      ];
};

const saveLocalWallets = (wallets: any[], token?: string) =>
  AsyncStorage.setItem(`${LOCAL_WALLETS_KEY}_${getUserIdFromToken(token)}`, JSON.stringify(wallets));

const request = async (
  path: string,
  method: string,
  token?: string,
  body?: unknown,
  timeoutMs = 5000
): Promise<any> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${P2P_API_URL}${path}`, {
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

export const p2pApi = {
  /**
   * Tra cứu thông tin người nhận an toàn qua username, SĐT, email hoặc ID
   */
  async lookupRecipient(
    token: string | undefined,
    query: string
  ): Promise<P2PApiResponse<P2PRecipient>> {
    try {
      return await request(`/lookup?query=${encodeURIComponent(query)}`, 'GET', token);
    } catch {
      const q = String(query || '').trim();
      if (!q) {
        return {
          success: false,
          offline: true,
          message: 'Vui lòng cung cấp thông tin tra cứu.',
        };
      }

      // Tra trong danh sách mock người nhận
      let matched = MOCK_RECIPIENTS.find(
        (r) =>
          r.id === q ||
          r._id === q ||
          r.username.toLowerCase() === q.toLowerCase() ||
          r.phone === q ||
          (r.email && r.email.toLowerCase() === q.toLowerCase())
      );

      // Nếu không tìm thấy, giả lập tạo người nhận theo query để test UI không bị chặn
      if (!matched) {
        matched = {
          id: q.startsWith('{') ? 'rec_qr' : `rec_${q.replace(/[^a-zA-Z0-9]/g, '') || 'target'}`,
          _id: q.startsWith('{') ? 'rec_qr' : `rec_${q.replace(/[^a-zA-Z0-9]/g, '') || 'target'}`,
          username: q.startsWith('{') ? 'qr_user' : q,
          nickname: q.startsWith('{') ? 'Người nhận từ QR' : `Người nhận (${q})`,
          phone: /^\d{10}$/.test(q) ? q : '0900000000',
          email: `${q.toLowerCase()}@financeflow.local`,
          avatar: null,
        };
      }

      return {
        success: true,
        offline: true,
        data: matched,
        recipient: matched,
      };
    }
  },

  /**
   * Thực hiện chuyển tiền P2P nguyên tử kèm kiểm tra mã PIN và số dư ví
   */
  async transfer(
    token: string | undefined,
    data: P2PTransferInput
  ): Promise<P2PApiResponse<P2PTransferResult>> {
    try {
      return await request('/transfer', 'POST', token, data);
    } catch {
      // Offline fallback: Trừ tiền ví local, tạo giao dịch chuyển tiền
      const numericAmount = Number(data.amount);
      if (!Number.isFinite(numericAmount) || numericAmount < 1000 || numericAmount > 10000000) {
        return {
          success: false,
          offline: true,
          message: 'Số tiền chuyển phải từ 1.000 đ đến 10.000.000 đ.',
        };
      }

      if (!data.pin || !/^\d{6}$/.test(String(data.pin))) {
        return {
          success: false,
          offline: true,
          code: 'PIN_INVALID',
          message: 'Mã PIN phải bao gồm đúng 6 chữ số.',
        };
      }

      // Xác thực PIN qua securityApi local
      const verifyRes = await securityApi.verifyPin(token, data.pin);
      if (!verifyRes.success) {
        return {
          success: false,
          offline: true,
          code: verifyRes.code || 'PIN_INVALID',
          message: verifyRes.message || 'Mã PIN không chính xác.',
          attemptsLeft: verifyRes.attemptsLeft,
          lockRemainingSeconds: verifyRes.lockRemainingSeconds,
        };
      }

      // Tải ví local
      const wallets = await loadLocalWallets(token);
      const targetWalletId = data.walletId || data.fromWalletId;
      let wallet = targetWalletId
        ? wallets.find((w) => (w._id || w.id) === targetWalletId)
        : wallets.find((w) => !w.isArchived && w.balance >= numericAmount) || wallets[0];

      if (!wallet) {
        return {
          success: false,
          offline: true,
          message: 'Không tìm thấy ví nguồn hợp lệ.',
        };
      }

      if (wallet.balance < numericAmount && wallet.type !== 'credit_card') {
        return {
          success: false,
          offline: true,
          code: 'INSUFFICIENT_BALANCE',
          message: 'Số dư trong ví không đủ để thực hiện giao dịch chuyển tiền.',
          currentBalance: wallet.balance,
          requiredAmount: numericAmount,
          shortfall: numericAmount - wallet.balance,
        };
      }

      // Trừ số dư ví
      wallet.balance -= numericAmount;
      await saveLocalWallets(wallets, token);

      // Tra cứu tên người nhận
      const mock = MOCK_RECIPIENTS.find(
        (r) => r.id === data.recipientId || r._id === data.recipientId
      );
      const recipientName =
        mock?.nickname || mock?.username || data.recipientId || 'Người dùng FinanceFlow';

      // Tạo transaction record
      const tx = {
        _id: `tx_p2p_${Date.now()}`,
        userId: 'local_user',
        walletId: wallet._id || wallet.id,
        categoryId: null,
        amount: numericAmount,
        type: 'transfer_out',
        counterpartUserId: data.recipientId,
        counterpartName: recipientName,
        note: data.note || `Chuyển tiền đến ${recipientName}`,
        transferNote: data.note || '',
        source: 'p2p',
        transactionDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        idempotencyKey: data.idempotencyKey,
      };

      const rawTx = await AsyncStorage.getItem(LOCAL_TX_KEY);
      const txList = rawTx ? JSON.parse(rawTx) : [];
      txList.unshift(tx);
      await AsyncStorage.setItem(LOCAL_TX_KEY, JSON.stringify(txList));

      // Lưu lịch sử P2P
      const p2pRecord = {
        _id: `p2p_${Date.now()}`,
        senderId: 'local_user',
        receiverId: data.recipientId,
        amount: numericAmount,
        note: data.note || '',
        recipientName,
        direction: 'sent',
        status: 'completed',
        createdAt: new Date().toISOString(),
      };

      const rawP2p = await AsyncStorage.getItem(LOCAL_P2P_KEY);
      const p2pList = rawP2p ? JSON.parse(rawP2p) : [];
      p2pList.unshift(p2pRecord);
      await AsyncStorage.setItem(LOCAL_P2P_KEY, JSON.stringify(p2pList));

      return {
        success: true,
        offline: true,
        message: 'Chuyển tiền thành công!',
        data: {
          transactionId: tx._id,
          amount: numericAmount,
          recipientName,
          newBalance: wallet.balance,
        },
      };
    }
  },

  /**
   * Lấy lịch sử giao dịch chuyển tiền P2P
   */
  async listTransfers(
    token?: string,
    params?: { direction?: string; page?: number; limit?: number }
  ): Promise<P2PApiResponse<any[]>> {
    try {
      const query = new URLSearchParams();
      if (params?.direction) query.append('direction', params.direction);
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));
      return await request(`/transfers?${query.toString()}`, 'GET', token);
    } catch {
      const raw = await AsyncStorage.getItem(LOCAL_P2P_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return {
        success: true,
        offline: true,
        data: list,
      };
    }
  },

  /**
   * Lấy chi tiết một giao dịch chuyển tiền P2P theo ID
   */
  async getTransferById(token: string | undefined, id: string): Promise<P2PApiResponse> {
    try {
      return await request(`/transfers/${id}`, 'GET', token);
    } catch {
      const raw = await AsyncStorage.getItem(LOCAL_P2P_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const item = list.find((t: any) => t._id === id || t.id === id);
      if (!item) {
        return {
          success: false,
          offline: true,
          message: 'Không tìm thấy thông tin giao dịch.',
        };
      }
      return {
        success: true,
        offline: true,
        data: item,
      };
    }
  },
};

export default p2pApi;
