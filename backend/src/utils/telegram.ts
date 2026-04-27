import crypto from 'node:crypto';

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

function parseInitData(initData: string): Map<string, string> {
  const params = new URLSearchParams(initData);
  const map = new Map<string, string>();
  for (const [k, v] of params.entries()) map.set(k, v);
  return map;
}

function buildDataCheckString(params: Map<string, string>): string {
  const pairs: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k === 'hash') continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort((a, b) => a.localeCompare(b));
  return pairs.join('\n');
}

/**
 * Telegram WebApp initData verification.
 * Ref: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export function verifyTelegramInitData(initData: string, botToken: string): {
  ok: true;
  user: TelegramUser | null;
  authDate?: number;
} | {
  ok: false;
  reason: string;
} {
  const params = parseInitData(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'Missing hash' };

  const dataCheckString = buildDataCheckString(params);

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // timing-safe compare
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(computedHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Invalid signature' };
  }

  const authDate = params.get('auth_date');
  const authDateNum = authDate ? Number(authDate) : undefined;

  const userRaw = params.get('user');
  let user: TelegramUser | null = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as TelegramUser;
    } catch {
      user = null;
    }
  }

  return { ok: true, user, authDate: authDateNum };
}

