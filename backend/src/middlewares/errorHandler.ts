import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../utils/httpError.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof HttpError
      ? err.message
      : process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : (err as Error).message;

  res.status(status).json({
    error: {
      message,
      status,
    },
  });
};

