import { API_BASE_URL as ROOT_API_URL } from './config';

export interface NetWorthPoint {
  _id?: string;
  month: string; // YYYY-MM
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

const BASE = `${ROOT_API_URL}/networth`;

const headers = (token?: string) => ({
  'Content-Type': 'application/json',
  ...(token && { Authorization: `Bearer ${token}` }),
});

export const netWorthApi = {
  /** Xu hướng tài sản ròng N tháng gần nhất. Mất mạng trả danh sách rỗng. */
  async getTrend(token?: string, months = 6): Promise<NetWorthPoint[]> {
    try {
      const res = await fetch(`${BASE}/trend?months=${months}`, { headers: headers(token) });
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  },

  /** Chụp ngay tài sản ròng tháng hiện tại. */
  async snapshot(token?: string): Promise<NetWorthPoint | null> {
    try {
      const res = await fetch(`${BASE}/snapshot`, { method: 'POST', headers: headers(token) });
      const json = await res.json();
      return json.success ? json.data : null;
    } catch {
      return null;
    }
  },
};
