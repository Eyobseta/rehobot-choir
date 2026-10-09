import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Minimal development request logger.
 * In production, replace with a proper structured logger.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (env.nodeEnv === 'test') return next();

  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    // Only log in development for noise reduction
    if (env.nodeEnv === 'development' || status >= 400) {
      // eslint-disable-next-line no-console
      console.log(`[${method}] ${originalUrl} → ${status} (${ms}ms)`);
    }
  });

  next();
}