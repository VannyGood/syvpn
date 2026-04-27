import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { verifyTelegramInitData } from '../utils/telegram.js';
import { signJwt } from '../services/jwtService.js';

export const telegramAuth = asyncHandler(async (req, res) => {
  const initData = typeof req.body?.initData === 'string' ? req.body.initData : null;
  if (!initData) throw new HttpError(400, 'initData is required');

  const verified = verifyTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!verified.ok) throw new HttpError(401, `Telegram auth failed: ${verified.reason}`);

  const tgUser = verified.user;
  if (!tgUser?.id) throw new HttpError(401, 'Telegram user missing');

  const telegramId = String(tgUser.id);
  const username = tgUser.username ?? tgUser.first_name ?? null;

  const user = await prisma.user.upsert({
    where: { telegramId },
    update: { username: username ?? undefined },
    create: { telegramId, username: username ?? undefined },
  });

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

