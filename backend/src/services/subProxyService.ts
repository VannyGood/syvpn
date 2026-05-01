import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

/** Max distinct devices per subscription (single public link). */
export const MAX_SUBSCRIPTION_DEVICES = 2;

function normalizeMarzbanBaseUrl(): string {
  return env.MARZBAN_URL.replace(/\/dashboard\/?$/i, '').replace(/\/+$/g, '');
}

/**
 * Marzban often stores subscription_url as https://public-domain/sub/TOKEN.
 * If nginx sends all /sub to SYVPN, server-side axios must fetch Marzban directly (loop break).
 */
export function resolveSubscriptionUpstreamUrl(configUrl: string): string {
  let cu: URL;
  try {
    cu = new URL(configUrl);
  } catch {
    return configUrl;
  }
  let pub: URL;
  try {
    pub = new URL(env.PUBLIC_BASE_URL);
  } catch {
    return configUrl;
  }
  if (cu.origin !== pub.origin || !cu.pathname.startsWith('/sub/')) {
    return configUrl;
  }

  if (env.MARZBAN_INTERNAL_ORIGIN) {
    const internal = new URL(env.MARZBAN_INTERNAL_ORIGIN);
    return `${internal.origin}${cu.pathname}${cu.search}`;
  }

  const mb = normalizeMarzbanBaseUrl();
  try {
    const mbu = new URL(mb.startsWith('http') ? mb : `https://${mb}`);
    if (mbu.origin !== pub.origin) {
      return `${mbu.origin}${cu.pathname}${cu.search}`;
    }
  } catch {
    /* fall through */
  }

  // Same host in MARZBAN_URL and PUBLIC_BASE_URL — common default for local Marzban
  return `http://127.0.0.1:8000${cu.pathname}${cu.search}`;
}

export function publicSubscriptionUrl(token: string) {
  const base = env.PUBLIC_BASE_URL.replace(/\/+$/g, '');
  return `${base}/sub/${token}`;
}

export async function ensurePublicSubToken(subscriptionId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new Error('Subscription not found');
  if (sub.publicSubToken) return sub.publicSubToken;
  const token = crypto.randomBytes(18).toString('base64url');
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { publicSubToken: token },
  });
  return token;
}
