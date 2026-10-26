import { API_BASE_URL as ROOT_API_URL } from './config';

export interface BillReminderItem {
  _id: string;
  title: string;
  amount: number;
  dueDate: string;
  repeatCycle: 'monthly' | 'weekly' | 'none';
  status: 'pending' | 'paid';
}

export interface BillInput {
  title: string;
  amount: number;
  dueDate: string;
  repeatCycle?: BillReminderItem['repeatCycle'];
}

const BASE = `${ROOT_API_URL}/bill-reminders`;

const call = async (path: string, method: string, token?: string, body?: unknown): Promise<any> => {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return { success: false, code: 'NETWORK_ERROR', message: 'Mất kết nối mạng, không thể thực hiện thao tác.' };
  }
};

export const billReminderApi = {
  list: (token?: string, status?: 'pending' | 'paid') => call(status ? `?status=${status}` : '', 'GET', token),
  create: (token: string | undefined, input: BillInput) => call('', 'POST', token, input),
  update: (token: string | undefined, id: string, input: Partial<BillInput>) => call(`/${id}`, 'PATCH', token, input),
  remove: (token: string | undefined, id: string) => call(`/${id}`, 'DELETE', token),
  /** Thanh toán hóa đơn từ ví; thiếu số dư trả code INSUFFICIENT_BALANCE. */
  pay: (token: string | undefined, id: string, walletId: string, categoryId?: string) =>
    call(`/${id}/pay`, 'POST', token, { walletId, categoryId }),
};
