import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { requirePlan } from '../services/planService.js';
import { marzban } from '../services/marzbanService.js';

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export const subscribe = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const planTypeRaw = typeof req.body?.plan_type === 'string' ? req.body.plan_type : '';
  const plan = requirePlan(planTypeRaw);

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) throw new HttpError(404, 'User not found');

  // Wallet check (paid deposits - paid purchases)
  const [deposits, purchases] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: user.id, status: 'paid', kind: 'deposit' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: user.id, status: 'paid', kind: 'purchase' },
      _sum: { amount: true },
    }),
  ]);
  const balance = Number(deposits._sum.amount ?? 0) - Number(purchases._sum.amount ?? 0);
  if (balance < plan.priceUsd) throw new HttpError(400, 'Insufficient wallet balance');

  const now = new Date();
  const expiresAt = addDays(now, plan.days);

  // Create subscription record first (inactive) then activate after Marzban succeeds
  const sub = await prisma.subscription.create({
    data: {
      userId: user.id,
      planType: plan.id,
      status: 'inactive',
      expiresAt,
    },
  });

  // Create Marzban user + fetch config
  const marzbanUsername = `tg_${user.telegramId}_${sub.id.slice(0, 8)}`;
  const created = await marzban.createUser({ username: marzbanUsername, expireAt: expiresAt });

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'active',
      marzbanUserId: created.marzbanUserId,
      configUrl: created.subscriptionUrl,
    },
  });

  // Deduct wallet with a paid purchase transaction
  await prisma.transaction.create({
    data: {
      userId: user.id,
      amount: plan.priceUsd,
      currency: 'USD',
      kind: 'purchase',
      status: 'paid',
      approvalToken: crypto.randomUUID(), // unique token
    },
  });

  res.json({
    subscription: {
      id: updated.id,
      plan_type: updated.planType,
      status: updated.status,
      expires_at: updated.expiresAt,
      marzban_user_id: updated.marzbanUserId,
      config_url: updated.configUrl,
    },
  });
});

export const getConfig = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const sub = await prisma.subscription.findFirst({
    where: { userId: req.user.sub, status: 'active', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub?.configUrl) throw new HttpError(404, 'No active subscription/config');

  res.json({
    config_url: sub.configUrl,
    expires_at: sub.expiresAt,
    plan_type: sub.planType,
  });
});

