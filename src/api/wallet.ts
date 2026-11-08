import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL as ROOT_API_URL } from './config';
import { dispatchBalanceNotification } from '../services/socketService';

export interface WalletItem {
  _id: string;
  id?: string;
  userId: string;
  name: string;
  type: 'cash' | 'bank' | 'credit_card' | 'savings' | 'investment';
  balance: number;
  currency: string;
  accountNumber?: string | null;
  bankName?: string | null;
  isExcludedFromNetWorth?: boolean;
  isArchived?: boolean;
}

export interface CreateWalletInput {
  name: string;
  type: WalletItem['type'];
  balance?: number;
  accountNumber?: string;
  bankName?: string;
  isExcludedFromNetWorth?: boolean;
}

export type UpdateWalletInput = Partial<CreateWalletInput>;

export interface TopupInput {
  amount: number;
  categoryId?: string;
  note?: string;
}

/** Kết quả chuẩn của các API ví. `code` = INSUFFICIENT_BALANCE... khi có lỗi nghiệp vụ. */
export interface ApiResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  offline?: boolean;
  [key: string]: any;
}

const API_BASE_URL = `${ROOT_API_URL}/wallets`;
const LOCAL_WALLETS_KEY = '@financeflow_local_wallets';
const LOCAL_TX_KEY = '@financeflow_local_transactions';

const idOf = (w: { _id?: string; id?: string }) => (w._id || w.id) as string;

/**
 * Decode userId tu JWT token (khong verify signature).
 * Chi dung de phan biet offline storage theo tung user, tranh hien thi so du cheo.
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

const localWalletsKey = (token?: string) =>
  `${LOCAL_WALLETS_KEY}_${getUserIdFromToken(token)}`;

const loadLocalWallets = async (token?: string): Promise<WalletItem[]> => {
  const key = localWalletsKey(token);
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

const saveLocalWallets = (wallets: WalletItem[], token?: string) =>
  AsyncStorage.setItem(localWalletsKey(token), JSON.stringify(wallets));

const insufficient = (balance: number, required: number): ApiResult => ({
  success: false,
  code: 'INSUFFICIENT_BALANCE',
  message: 'Số dư trong ví không đủ để thực hiện giao dịch.',
  currentBalance: balance,
  requiredAmount: required,
  shortfall: Math.max(0, required - balance),
});

const request = async (path: string, method: string, token?: string, body?: unknown): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const newKey = () => `topup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const walletApi = {
  async getWallets(token?: string) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(API_BASE_URL, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch {
      const wallets = await loadLocalWallets(token);
      return { success: true, data: wallets };
    }
  },

  async getDefaultWallet(token?: string): Promise<WalletItem | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${API_BASE_URL}/default`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success && data.data) return data.data;
      return null;
    } catch {
      const walletsRes = await this.getWallets(token);
      if (walletsRes.success && walletsRes.data?.length > 0) {
        return walletsRes.data[0];
      }
      return null;
    }
  },

  /** Tạo ví mới. Ví thường không được âm; ví credit_card được âm (dư nợ). */
  async createWallet(token: string | undefined, input: CreateWalletInput): Promise<ApiResult<WalletItem>> {
    try {
      const res = await request('', 'POST', token, input);
      return await res.json();
    } catch {
      const balance = Number(input.balance ?? 0);
      if (!Number.isFinite(balance) || (balance < 0 && input.type !== 'credit_card')) {
        return { success: false, message: 'Số dư ban đầu không được âm.' };
      }
      const wallets = await loadLocalWallets(token);
      const id = `w_${Date.now()}`;
      const wallet: WalletItem = {
        _id: id,
        id,
        userId: 'local_user',
        name: input.name.trim(),
        type: input.type,
        balance,
        currency: 'VND',
        accountNumber: input.accountNumber || null,
        bankName: input.bankName || null,
        isExcludedFromNetWorth: !!input.isExcludedFromNetWorth,
      };
      wallets.push(wallet);
      await saveLocalWallets(wallets, token);
      return { success: true, data: wallet, offline: true };
    }
  },

  /**
   * Sửa ví. Sửa `balance` trực tiếp KHÔNG tạo giao dịch (dùng để đối soát tiền thực tế).
   */
  async updateWallet(token: string | undefined, walletId: string, input: UpdateWalletInput): Promise<ApiResult<WalletItem>> {
    try {
      const res = await request(`/${walletId}`, 'PATCH', token, input);
      return await res.json();
    } catch {
      const wallets = await loadLocalWallets(token);
      const wallet = wallets.find((w) => idOf(w) === walletId);
      if (!wallet) return { success: false, message: 'Không tìm thấy ví.' };
      if (input.balance !== undefined) {
        const balance = Number(input.balance);
        if (!Number.isFinite(balance) || (balance < 0 && wallet.type !== 'credit_card')) {
          return { success: false, message: 'Số dư không được âm.' };
        }
        wallet.balance = balance;
      }
      if (input.name !== undefined) wallet.name = input.name.trim();
      if (input.isExcludedFromNetWorth !== undefined) wallet.isExcludedFromNetWorth = input.isExcludedFromNetWorth;
      await saveLocalWallets(wallets, token);
      return { success: true, data: wallet, offline: true };
    }
  },

  /** Xóa mềm ví (không xóa ví cuối cùng). */
  async deleteWallet(token: string | undefined, walletId: string): Promise<ApiResult> {
    try {
      const res = await request(`/${walletId}`, 'DELETE', token);
      return await res.json();
    } catch {
      const wallets = await loadLocalWallets(token);
      if (wallets.filter((w) => !w.isArchived).length <= 1) {
        return { success: false, message: 'Không thể xóa ví cuối cùng.' };
      }
      const wallet = wallets.find((w) => idOf(w) === walletId);
      if (wallet) wallet.isArchived = true;
      await saveLocalWallets(wallets, token);
      return { success: true, offline: true };
    }
  },

  /**
   * Nạp tiền vào ví (tạo giao dịch thu). Mặc định danh mục "Lương".
   * Kèm idempotencyKey để bấm đúp / gửi lại không nạp trùng.
   */
  async topupWallet(token: string | undefined, walletId: string, input: TopupInput, idempotencyKey = newKey()): Promise<ApiResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${ROOT_API_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          walletId,
          type: 'income',
          amount: input.amount,
          categoryId: input.categoryId,
          note: input.note || 'Nạp tiền vào ví',
          idempotencyKey,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await res.json();
    } catch {
      const amount = Number(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) return { success: false, message: 'Số tiền không hợp lệ.' };
      const wallets = await loadLocalWallets(token);
      const wallet = wallets.find((w) => idOf(w) === walletId);
      if (!wallet) return { success: false, message: 'Không tìm thấy ví.' };
      wallet.balance += amount;
      await saveLocalWallets(wallets, token);

      dispatchBalanceNotification({
        type: 'income',
        direction: 'in',
        amount,
        walletName: wallet.name,
        newBalance: wallet.balance,
        note: input.note || 'Nạp tiền vào ví',
      });

      const tx = {
        _id: `tx_${Date.now()}`,
        userId: 'local_user',
        walletId,
        categoryId: input.categoryId || null,
        amount,
        type: 'income',
        transactionDate: new Date().toISOString(),
        note: input.note || '',
        createdAt: new Date().toISOString(),
      };
      const rawTx = await AsyncStorage.getItem(LOCAL_TX_KEY);
      const list = rawTx ? JSON.parse(rawTx) : [];
      list.unshift(tx);
      await AsyncStorage.setItem(LOCAL_TX_KEY, JSON.stringify(list));
      return { success: true, data: { wallet, transaction: tx }, offline: true };
    }
  },

  insufficient,

  /** Lấy 1 số tài khoản "đẹp" (dễ nhớ) từ server để gợi ý cho user. */
  async suggestAccount(token?: string): Promise<ApiResult<{ accountNumber: string }>> {
    try {
      const res = await fetch(`${API_BASE_URL}/suggest-account`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      return await res.json();
    } catch {
      return { success: false, message: 'Không thể kết nối server.' };
    }
  },

  /** Kiểm tra số tài khoản người dùng tự nhập có hợp lệ và chưa bị trùng không. */
  async checkAccount(token?: string, accountNumber?: string): Promise<ApiResult> {
    try {
      const res = await fetch(`${API_BASE_URL}/check-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ accountNumber }),
      });
      return await res.json();
    } catch {
      return { success: false, message: 'Không thể kết nối server.' };
    }
  },

  /** Gán số tài khoản cho ví (chỉ dùng 1 lần – khi ví chưa có STK). */
  async setAccount(token?: string, walletId?: string, accountNumber?: string): Promise<ApiResult<WalletItem>> {
    try {
      const res = await fetch(`${API_BASE_URL}/${walletId}/set-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ accountNumber }),
      });
      return await res.json();
    } catch {
      return { success: false, message: 'Không thể kết nối server.' };
    }
  },
};
