import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export type JwtPayload = {
  sub: string; // userId
  telegramId: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __auth: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}

export const authJwt: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing Authorization header'));
  }

  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (!decoded.sub || typeof decoded.sub !== 'string') throw new Error('Invalid token');
    const telegramId = decoded.telegramId;
    if (!telegramId || typeof telegramId !== 'string') throw new Error('Invalid token');
    req.user = { sub: decoded.sub, telegramId };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid token'));
  }
};

