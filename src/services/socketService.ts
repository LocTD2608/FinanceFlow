import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/config';
import { soundService } from './soundService';
import { useSettingsStore } from '../store/useSettingsStore';
import { useNotificationStore } from '../store/useNotificationStore';

export interface BalanceNotificationPayload {
  id?: string;
  type?: 'income' | 'expense' | 'transfer' | string;
  direction: 'in' | 'out';
  amount: number;
  walletName: string;
  newBalance: number;
  note?: string;
  senderName?: string;
  recipientName?: string;
  timestamp?: string;
}

let socket: Socket | null = null;

/**
 * Xử lý thông báo biến động số dư tập trung:
 * 1. Phát âm thanh "Ting Ting" (C6-E6 hoặc A5) nếu người dùng bật
 * 2. Đưa vào hàng đợi Toast banner nổi trên màn hình nếu bật
 * 3. Tự động trigger refresh dữ liệu dòng tiền & giao dịch Dashboard
 */
export const dispatchBalanceNotification = (data: BalanceNotificationPayload) => {
  const { soundEnabled, toastEnabled } = useSettingsStore.getState();

  // 1. Phát âm thanh Ting Ting
  if (soundEnabled) {
    soundService.playChime(data.direction);
  }

  // 2. Đưa vào hàng đợi Toast banner
  if (toastEnabled) {
    const notifType: 'income' | 'expense' | 'transfer' =
      data.type === 'expense' ? 'expense' : data.type === 'transfer' ? 'transfer' : 'income';

    useNotificationStore.getState().notify({
      id: data.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: notifType,
      direction: data.direction,
      amount: data.amount,
      walletName: data.walletName,
      newBalance: data.newBalance,
      note: data.note,
      timestamp: data.timestamp || new Date().toISOString(),
    });
  }

  // 3. Tự động làm mới dữ liệu giao dịch & tổng quan trên Dashboard
  try {
    const { useAuthStore } = require('../store/useAuthStore');
    const { useTransactionStore } = require('../store/useTransactionStore');
    const token = useAuthStore.getState().token || undefined;
    const txStore = useTransactionStore.getState();
    if (typeof txStore.fetchSummary === 'function') {
      txStore.fetchSummary(token).catch(() => {});
    }
    if (typeof txStore.fetchTransactions === 'function') {
      txStore.fetchTransactions(token).catch(() => {});
    }
  } catch {
    // Không làm gián đoạn UI nếu lỗi store refresh
  }
};

/**
 * Khởi tạo kết nối Socket.io với máy chủ kèm JWT token xác thực
 */
export const initSocketConnection = (token?: string): Socket | null => {
  const currentToken = token || (() => { try { return require('../store/useAuthStore').useAuthStore.getState().token || ''; } catch { return ''; } })();
  if (!currentToken) {
    return null;
  }

  if (socket && (socket.connected || (socket as any).active)) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');

  socket = io(socketUrl, {
    auth: {
      token: currentToken,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    // Connected
  });

  socket.on('balance:change', (payload: BalanceNotificationPayload) => {
    dispatchBalanceNotification(payload);
  });

  socket.on('connect_error', () => {
    // Lỗi kết nối âm thầm chuyển sang cơ chế polling hoặc offline fallback
  });

  return socket;
};

/**
 * Ngắt kết nối Socket.io
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;
