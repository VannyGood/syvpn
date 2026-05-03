import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({
    id: user.id,
    telegram_id: user.telegramId,
    username: user.username,
    trial_claimed_at: user.trialClaimedAt,
    created_at: user.createdAt,
  });
});

