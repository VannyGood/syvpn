import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { requirePlan } from '../services/planService.js';
import { marzban } from '../services/marzbanService.js';
import { ensurePublicSubToken, publicSubscriptionUrl } from '../services/subProxyService.js';

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function marzbanUsernameForSubscription(telegramId: string, subscriptionId: string, kind: 'trial' | 'paid') {
  const base = `tg_${telegramId}_${subscriptionId.slice(0, 8)}`;
  return kind === 'trial' ? `trial_${base}` : base;
}

export const subscribe = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const planTypeRaw = typeof req.body?.plan_type === 'string' ? req.body.plan_type : '';
  const plan = requirePlan(planTypeRaw);

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) throw new HttpError(404, 'User not found');

  // Upgrade path: allow buying while trial is active.
  const currentActive = await prisma.subscription.findFirst({
    where: { userId: user.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  if (currentActive && currentActive.planType !== ('trial' as any)) {
    throw new HttpError(400, 'You already have an active plan');
  }

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

  // If trial is active, deactivate it so getConfig returns the paid plan.
  if (currentActive && currentActive.planType === ('trial' as any)) {
    await prisma.subscription.update({
      where: { id: currentActive.id },
      data: { status: 'inactive' },
    });
  }

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
  const marzbanUsername = marzbanUsernameForSubscription(user.telegramId, sub.id, 'paid');
  const created = await marzban.createUser({ username: marzbanUsername, expireAt: expiresAt });

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'active',
      marzbanUserId: created.marzbanUserId,
      configUrl: created.subscriptionUrl,
    },
  });

  const pubToken = await ensurePublicSubToken(updated.id);

  // Deduct wallet with a paid purchase transaction
  await prisma.transaction.create({
    data: {
      userId: user.id,
      amount: plan.priceUsd,
      // Prisma client types may lag behind schema in some deployments; keep runtime correct.
      currency: 'USD' as any,
      kind: 'purchase' as any,
      status: 'paid',
      approvalToken: crypto.randomUUID(), // unique token
    },
  });

  // Referral reward: when a referred user makes their first paid purchase, extend referrer by +15 days.
  if (user.referredById && !user.referralRewardedAt) {
    const referrerSub = await prisma.subscription.findFirst({
      where: { userId: user.referredById, status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    if (referrerSub?.user) {
      const newExpire = addDays(referrerSub.expiresAt, 15);
      await prisma.subscription.update({
        where: { id: referrerSub.id },
        data: { expiresAt: newExpire },
      });
      // Best-effort update in Marzban (so the user actually gets extra days).
      const mbName =
        (referrerSub.planType as any) === 'trial'
          ? marzbanUsernameForSubscription(referrerSub.user.telegramId, referrerSub.id, 'trial')
          : marzbanUsernameForSubscription(referrerSub.user.telegramId, referrerSub.id, 'paid');
      void marzban.setUserExpire(mbName, newExpire);

      await prisma.user.update({
        where: { id: user.id },
        data: { referralRewardedAt: new Date() },
      });
    }
  }

  res.json({
    subscription: {
      id: updated.id,
      plan_type: updated.planType,
      status: updated.status,
      expires_at: updated.expiresAt,
      marzban_user_id: updated.marzbanUserId,
      config_url: publicSubscriptionUrl(pubToken),
    },
  });
});

export const getConfig = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const sub = await prisma.subscription.findFirst({
    where: { userId: req.user.sub, status: 'active' },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  if (!sub?.configUrl || !sub.user) throw new HttpError(404, 'No active subscription/config');

  const mbUser =
    (sub.planType as any) === 'trial'
      ? marzbanUsernameForSubscription(sub.user.telegramId, sub.id, 'trial')
      : marzbanUsernameForSubscription(sub.user.telegramId, sub.id, 'paid');
  let remote = await marzban.fetchUserRemote(mbUser);
  if (!remote && sub.marzbanUserId && sub.marzbanUserId !== mbUser) {
    remote = await marzban.fetchUserRemote(sub.marzbanUserId);
  }

  let expiresAt = sub.expiresAt;
  let configUrl = sub.configUrl;

  if (remote) {
    const driftMs = Math.abs(sub.expiresAt.getTime() - remote.expireAt.getTime());
    const urlChanged =
      remote.subscriptionUrl && remote.subscriptionUrl !== sub.configUrl ? remote.subscriptionUrl : undefined;

    if (driftMs > 2000 || urlChanged) {
      const updated = await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          expiresAt: remote.expireAt,
          ...(urlChanged ? { configUrl: urlChanged } : {}),
        },
      });
      expiresAt = updated.expiresAt;
      configUrl = updated.configUrl ?? configUrl;
    }
  }

  if (expiresAt <= new Date()) throw new HttpError(404, 'No active subscription/config');

  const pubToken = await ensurePublicSubToken(sub.id);

  res.json({
    config_url: publicSubscriptionUrl(pubToken),
    max_devices: 2,
    expires_at: expiresAt,
    plan_type: sub.planType,
  });
});

export const resetSubDevices = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const sub = await prisma.subscription.findFirst({
    where: { userId: req.user.sub, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  if (!sub) throw new HttpError(404, 'No active subscription');

  await prisma.subDeviceFingerprint.deleteMany({ where: { subscriptionId: sub.id } });
  res.json({ ok: true });
});

export const claimTrial = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) throw new HttpError(404, 'User not found');

  if (user.trialClaimedAt) throw new HttpError(400, 'Trial already claimed');

  const active = await prisma.subscription.findFirst({
    where: { userId: user.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  if (active) throw new HttpError(400, 'You already have an active plan');

  const now = new Date();
  const expiresAt = addDays(now, 1);

  const sub = await prisma.subscription.create({
    data: {
      userId: user.id,
      planType: 'trial' as any,
      status: 'inactive',
      expiresAt,
    },
  });

  const marzbanUsername = marzbanUsernameForSubscription(user.telegramId, sub.id, 'trial');
  const created = await marzban.createUser({ username: marzbanUsername, expireAt: expiresAt });

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'active',
      marzbanUserId: created.marzbanUserId,
      configUrl: created.subscriptionUrl,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { trialClaimedAt: now },
  });

  const pubToken = await ensurePublicSubToken(updated.id);

  res.json({
    subscription: {
      id: updated.id,
      plan_type: updated.planType,
      status: updated.status,
      expires_at: updated.expiresAt,
      config_url: publicSubscriptionUrl(pubToken),
    },
  });
});

