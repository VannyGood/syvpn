import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { verifyTelegramInitData } from '../utils/telegram.js';
import { signJwt } from '../services/jwtService.js';
import { notifyUser } from '../services/telegramNotify.js';

function generateReferralCode() {
  // Short, URL-safe, non-guessy enough for referrals.
  return crypto.randomBytes(8).toString('base64url');
}

export const telegramAuth = asyncHandler(async (req, res) => {
  const initData = typeof req.body?.initData === 'string' ? req.body.initData : null;
  if (!initData) throw new HttpError(400, 'initData is required');
  const referralCodeRaw = typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim() : '';
  const referralCode = referralCodeRaw.length > 0 ? referralCodeRaw.slice(0, 64) : null;

  const verified = verifyTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!verified.ok) throw new HttpError(401, `Telegram auth failed: ${verified.reason}`);

  const tgUser = verified.user;
  if (!tgUser?.id) throw new HttpError(401, 'Telegram user missing');

  const telegramId = String(tgUser.id);
  const username = tgUser.username ?? tgUser.first_name ?? null;

  const existing = await prisma.user.findUnique({ where: { telegramId } });
  const isNew = !existing;
  // Resolve referrer (only for brand-new users).
  const referrer =
    isNew && referralCode
      ? await prisma.user.findUnique({
          where: { referralCode },
          select: { id: true },
        })
      : null;

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          username: username ?? undefined,
          // Backfill referral code for older users.
          ...(existing.referralCode ? {} : { referralCode: generateReferralCode() }),
        } as any,
      })
    : await prisma.user.create({
        data: {
          telegramId,
          username: username ?? undefined,
          referralCode: generateReferralCode(),
          // Prevent self-referral by telegram id (and ignore missing referrer).
          ...(referrer ? { referredById: referrer.id } : {}),
        } as any,
      });

  if (isNew) {
    const name = tgUser.first_name ?? tgUser.username ?? 'friend';
    try {
      await notifyUser(
        telegramId,
        `Welcome ${name}!\n\nYou have a free 1-day trial plan.\n\nOpen SYVPN mini app → VPN tab → Claim free trial.`
      );
    } catch {
      // Don't block auth if Telegram messaging fails.
    }
  }

  const token = signJwt({ userId: user.id, telegramId: user.telegramId });

  res.json({
    token,
    user: {
      id: user.id,
      telegram_id: user.telegramId,
      username: user.username,
      created_at: user.createdAt,
    },
  });
});

