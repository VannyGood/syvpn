import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

/** Max distinct devices per subscription (single public link). */
export const MAX_SUBSCRIPTION_DEVICES = 2;

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
