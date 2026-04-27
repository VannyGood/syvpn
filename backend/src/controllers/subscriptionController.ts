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

