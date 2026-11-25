import { API_BASE_URL as ROOT_API_URL } from './config';

export interface PendingDecisionGoal {
  _id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  overdueStage: 'none' | 'grace_24h' | 'decision_required';
  decisionRequiredAt?: string | null;
  extensionCount?: number;
  targetWalletId?: {
    _id: string;
    name: string;
    type?: string;
    currency?: string;
  } | null;
}

const API_BASE_URL = `${ROOT_API_URL}/goals`;

async function requestGoalApi<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<{ success: boolean; message?: string; data?: T }> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || 'Không thể xử lý yêu cầu mục tiêu.');
  }
  return json;
}

export const goalApi = {
  async getPendingDecisions(token: string): Promise<PendingDecisionGoal[]> {
    const res = await requestGoalApi<PendingDecisionGoal[]>('/pending-decision', token, {
      method: 'GET',
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  async extendGoal(token: string, goalId: string, newDeadline: string) {
    return requestGoalApi<PendingDecisionGoal>(`/${goalId}/extend`, token, {
      method: 'POST',
      body: JSON.stringify({ newDeadline }),
    });
  },

  async expireCloseGoal(token: string, goalId: string) {
    return requestGoalApi<{
      goal: PendingDecisionGoal;
      refundAmount: number;
      penaltyFee: number;
    }>(`/${goalId}/expire-close`, token, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
};
