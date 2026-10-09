import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof Error) {
    apiError = ApiError.internal();
    // Server-side errors (5xx) — log the full stack.
    // eslint-disable-next-line no-console
    console.error('[Unhandled Error]', err);
  } else {
    apiError = ApiError.internal();
    // eslint-disable-next-line no-console
    console.error('[Unhandled Non-Error]', err);
  }

  const body: Record<string, unknown> = {
    status: apiError.status,
    code: apiError.code,
    message: apiError.message,
  };

  // Only log stack for genuine server errors — never for 4xx.
  if (
    env.nodeEnv === 'development' &&
    apiError.status >= 500 &&
    err instanceof Error
  ) {
    // eslint-disable-next-line no-console
    console.error(err.stack);
  }

  res.status(apiError.status).json(body);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}