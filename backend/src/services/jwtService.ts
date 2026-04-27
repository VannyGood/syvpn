import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signJwt(payload: { userId: string; telegramId: string }) {
  // jsonwebtoken types can be finicky with TS/ESM; keep it explicit.
  return jwt.sign(
    { telegramId: payload.telegramId },
    env.JWT_SECRET as jwt.Secret,
    {
      subject: payload.userId,
      expiresIn: env.JWT_EXPIRES_IN as unknown as jwt.SignOptions['expiresIn'],
    } satisfies jwt.SignOptions
  );
}

