import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from './jwt';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '@prisma/client';

// Extend Express Request to carry the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
        sessionId: string;
      };
    }
  }
}

/**
 * Validates the JWT, verifies the session is not revoked,
 * and attaches the user to the request.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized();
    }

    const token = header.slice('Bearer '.length).trim();
    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token.', 'INVALID_TOKEN');
    }

    // Ensure the session is still active.
    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
    });
    if (!session || session.revokedAt || session.userId !== payload.sub) {
      throw ApiError.unauthorized('Session is no longer valid.', 'SESSION_REVOKED');
    }

    req.auth = {
      userId: payload.sub,
      role: payload.role,
      sessionId: payload.sid,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role gate. Use AFTER `authenticate` (SRS 24.5).
 *
 *   router.get('/admin-only', authenticate, authorize('ADMIN'), handler)
 */
export function authorize(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(ApiError.unauthorized());
    }
    if (!allowed.includes(req.auth.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}



/**
 * Fire-and-forget update of User.lastActiveAt on authenticated requests.
 * We do not await it — it must not slow down the request.
 */
/**
 * Fire-and-forget update of User.lastActiveAt on authenticated requests.
 */
export function touchLastActive(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth) {
    prisma.user
      .update({
        where: { id: req.auth.userId },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => {
        // Non-fatal; swallow.
      });
  }
  next();
}