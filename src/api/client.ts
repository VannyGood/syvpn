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
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      const snippet = text.trim().slice(0, 160).replace(/\s+/g, ' ');
      throw new Error(
        `Server sent a non-JSON reply (${res.status}). Usually nginx/proxy returned HTML (wrong URL or /backend not routed to the API). Start of body: ${snippet}${text.length > 160 ? '…' : ''}`
      );
    }
  }

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

export async function getMe() {
  return request<{
    id: string;
    telegram_id: string;
    username?: string | null;
    trial_claimed_at: string | null;
    referral_code: string | null;
    created_at: string;
  }>('GET', '/me');
}

export async function telegramAuth(initData: string, input?: { referralCode?: string | null }) {
  const resp = await request<{
    token: string;
    user: { id: string; telegram_id: string; username?: string | null };
  }>('POST', '/auth/telegram', { initData, referralCode: input?.referralCode ?? undefined });
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
      plan_type: 'monthly' | 'yearly' | 'trial';
      status: 'active' | 'inactive';
      expires_at: string;
      config_url: string | null;
    };
  }>('POST', '/subscribe', { plan_type: planType });
}

export async function claimTrial() {
  return request<{
    subscription: {
      id: string;
      plan_type: 'trial';
      status: 'active' | 'inactive';
      expires_at: string;
      config_url: string | null;
    };
  }>('POST', '/trial/claim', {});
}

export async function getConfig() {
  return request<{
    config_url: string;
    max_devices?: number;
    expires_at: string;
    plan_type: 'monthly' | 'yearly' | 'trial';
  }>('GET', '/config');
}

export async function resetSubDevices() {
  return request<{ ok: boolean }>('POST', '/config/sub-devices/reset', {});
}

export async function getWallet() {
  return request<{ balance: number }>('GET', '/wallet');
}

export type WalletTransaction = {
  id: string;
  kind: 'deposit' | 'purchase';
  status: 'pending' | 'paid' | 'declined';
  amount: string;
  currency: 'TON' | 'TRC20' | 'WHISH' | 'USD';
  created_at: string;
};

export async function getWalletTransactions() {
  return request<{ transactions: WalletTransaction[] }>('GET', '/wallet/transactions');
}

export async function iPaid(input: { amount: number; currency: 'TON' | 'TRC20' | 'WHISH' }) {
  return request<{
    transaction: { id: string; status: 'pending' | 'paid' | 'declined'; amount: string; currency: 'TON' | 'TRC20' | 'WHISH' | 'USD' };
  }>('POST', '/payments/i-paid', input);
}

