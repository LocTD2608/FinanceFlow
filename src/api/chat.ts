import { API_BASE_URL } from './config';

export interface ChatAction {
  id: string;
  kind: 'create_transaction' | 'create_budget';
  preview: {
    type?: 'income' | 'expense'; amount?: number; walletName?: string;
    categoryName: string; date?: string; note?: string; limitAmount?: number;
    month?: string; currency: 'VND';
  };
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  expiresAt: string;
}
export interface ChatReply {
  conversationId: string;
  reply: string;
  facts: Record<string, unknown>[];
  pendingAction: ChatAction | null;
}
export interface ChatConversation {
  conversationId: string;
  messages: { role: 'user' | 'model'; text: string }[];
  pendingAction: ChatAction | null;
}
export interface ChatConfirmation {
  kind: ChatAction['kind'];
  resultId: string;
  record: Record<string, unknown>;
}
export class ChatApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message); this.name = 'ChatApiError';
  }
}
async function request<T>(token: string, path: string, body?: object): Promise<T> {
  if (!token) throw new ChatApiError('Bạn cần đăng nhập để dùng chatbot.', 'UNAUTHORIZED', 401);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${API_BASE_URL}/chat${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new ChatApiError(result.message || 'Không thể xử lý yêu cầu chat.', result.code || 'CHAT_ERROR', res.status);
    return result.data as T;
  } finally { clearTimeout(timeout); }
}
export const chatApi = {
  sendMessage: (token: string, input: { message: string; conversationId?: string }) => request<ChatReply>(token, '/messages', input),
  getConversation: (token: string, id: string) => request<ChatConversation>(token, `/conversations/${encodeURIComponent(id)}`),
  // Call only from an explicit confirmation button. On uncertain network results,
  // retry this SAME action ID; never create a replacement transaction automatically.
  confirm: (token: string, id: string) => request<ChatConfirmation>(token, `/actions/${encodeURIComponent(id)}/confirm`, {}),
  cancel: (token: string, id: string) => request<{ id: string; status: ChatAction['status'] }>(token, `/actions/${encodeURIComponent(id)}/cancel`, {}),
};
