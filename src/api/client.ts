type HttpMethod = 'GET' | 'POST';

const TOKEN_KEY = 'syvpn_token';
const API_BASE = '/backend';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const msg =
      (data as any)?.error?.message ||
      (data as any)?.detail ||
      `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export type BackendPlan = {
  id: 'monthly' | 'yearly';
  name: string;
  price_usd: number;
  duration_days: number;
};

export async function telegramAuth(initData: string) {
  const resp = await request<{
    token: string;
    user: { id: string; telegram_id: string; username?: string | null };
  }>('POST', '/auth/telegram', { initData });
  setToken(resp.token);
  return resp;
}

export async function getPlans() {
  return request<{ plans: BackendPlan[] }>('GET', '/plans');
}

export async function subscribe(planType: 'monthly' | 'yearly') {
  return request<{
    subscription: {
      id: string;
      plan_type: 'monthly' | 'yearly';
      status: 'active' | 'inactive';
      expires_at: string;
      config_url: string | null;
    };
  }>('POST', '/subscribe', { plan_type: planType });
}

export async function getConfig() {
  return request<{
    config_url: string;
    expires_at: string;
    plan_type: 'monthly' | 'yearly';
  }>('GET', '/config');
}

export async function iPaid(input: { amount: number; currency: 'TON' | 'TRC20' | 'WHISH' }) {
  return request<{
    transaction: { id: string; status: 'pending' | 'paid' | 'declined'; amount: string; currency: 'TON' | 'TRC20' | 'WHISH' };
  }>('POST', '/payments/i-paid', input);
}

