import axios, { type AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

export class MarzbanService {
  private http: AxiosInstance;
  private token: TokenCache | null = null;
  private baseUrl: string;

  constructor() {
    // Users often paste the dashboard URL; API base should be the host root.
    this.baseUrl = env.MARZBAN_URL.replace(/\/dashboard\/?$/i, '').replace(/\/+$/g, '');
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 15_000,
    });
  }

  private async login(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAtMs > now + 30_000) {
      return this.token.accessToken;
    }

    // Marzban typically uses OAuth2 password flow at /api/admin/token
    // We keep this isolated so you can adjust endpoint if your Marzban differs.
    const form = new URLSearchParams();
    form.set('username', env.MARZBAN_USERNAME);
    form.set('password', env.MARZBAN_PASSWORD);

    let resp: { access_token: string; token_type?: string; expires_in?: number };
    try {
      const { data } = await this.http.post('/api/admin/token', form, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      resp = data;
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      const detail = axios.isAxiosError(e) ? e.response?.data : undefined;
      throw new HttpError(
        502,
        `Failed to login to Marzban${status ? ` (HTTP ${status})` : ''}${detail ? `: ${JSON.stringify(detail)}` : ''}`,
        false
      );
    }

    if (!resp?.access_token) throw new HttpError(502, 'Marzban login returned no token', false);
    const expiresInSec = typeof resp.expires_in === 'number' ? resp.expires_in : 3600;
    this.token = {
      accessToken: resp.access_token,
      expiresAtMs: Date.now() + expiresInSec * 1000,
    };
    return resp.access_token;
  }

  private async authed() {
    const token = await this.login();
    return axios.create({
      baseURL: this.baseUrl,
      timeout: 15_000,
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  private async getSystemInbounds(http: AxiosInstance): Promise<Record<string, string[]> | null> {
    try {
      const { data } = await http.get('/api/system/inbounds');
      // expected shape: { inbounds: { vless: ["tag1"], vmess: ["tag2"] ... } } or directly { vless: [...] }
      const inbounds = (data?.inbounds ?? data) as unknown;
      if (!inbounds || typeof inbounds !== 'object') return null;
      return inbounds as Record<string, string[]>;
    } catch {
      // Older/newer versions may not expose this endpoint. We'll treat it as optional.
      return null;
    }
  }

  private pickProtocol(inbounds: Record<string, string[]> | null): string {
    // Force VLESS for REALITY/TCP
    const protocol = 'vless';
    if (inbounds && Array.isArray(inbounds[protocol]) && inbounds[protocol].length > 0) return protocol;
    return protocol;
  }

  async createUser(input: { username: string; expireAt: Date }): Promise<{ marzbanUserId: string; subscriptionUrl: string }> {
    const http = await this.authed();

    const inbounds = await this.getSystemInbounds(http);
    const protocol = this.pickProtocol(inbounds);
    // If we can't fetch inbounds (or endpoint is missing), let Marzban use its defaults.
    // This avoids false negatives when Marzban doesn't expose /api/system/inbounds.
    const inboundTags = inbounds && Array.isArray(inbounds[protocol]) ? inbounds[protocol] : [];
    const forcedTag = env.MARZBAN_INBOUND_TAG;
    const inboundsForProtocol = forcedTag
      ? { [protocol]: [forcedTag] }
      : (inboundTags.length > 0 ? { [protocol]: inboundTags } : {});

    // Marzban v0.8+ requires `proxies` and usually `data_limit_reset_strategy`.
    // Use detected protocol; prefer restricting inbounds to avoid returning multiple protocols in the subscription.
    const payload = {
      username: input.username,
      expire: Math.floor(input.expireAt.getTime() / 1000),
      status: 'active',
      data_limit: 0,
      data_limit_reset_strategy: 'no_reset',
      // For REALITY, most clients expect vision flow.
      proxies: protocol === 'vless'
        ? { vless: { flow: 'xtls-rprx-vision' } }
        : { [protocol]: {} },
      inbounds: inboundsForProtocol,
    };

    try {
      const { data } = await http.post('/api/user', payload);
      const marzbanUserId = String(data?.id ?? data?.username ?? input.username);
      const subscriptionUrl = String(data?.subscription_url ?? data?.subscriptionUrl ?? data?.link ?? '');
      if (!subscriptionUrl) {
        // Fallback: try to fetch user details if create doesn't return URL
        const { data: userData } = await http.get(`/api/user/${encodeURIComponent(input.username)}`);
        const url = String(userData?.subscription_url ?? userData?.subscriptionUrl ?? userData?.link ?? '');
        if (!url) throw new Error('Missing subscription_url');
        return { marzbanUserId, subscriptionUrl: url };
      }
      return { marzbanUserId, subscriptionUrl };
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      const detail = axios.isAxiosError(e) ? e.response?.data : undefined;
      throw new HttpError(
        502,
        `Failed to create user in Marzban${status ? ` (HTTP ${status})` : ''}${detail ? `: ${JSON.stringify(detail)}` : ''}`,
        false
      );
    }
  }
}

export const marzban = new MarzbanService();

