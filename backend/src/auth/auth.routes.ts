import { Router, Request, Response } from 'express';
import { loginWithPhone } from './auth.service';
import { authenticate } from './middleware';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { refreshSession } from './auth.service';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Body: { phone, password, deviceLabel? }
 */
router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { phone, password, deviceLabel } = req.body ?? {};
    const result = await loginWithPhone({ phone, password, deviceLabel });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/logout
 * Revokes the current session.
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    await prisma.session.update({
      where: { id: req.auth.sessionId },
      data: { revokedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});



/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken, deviceLabel? }
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken, deviceLabel } = req.body ?? {};
    const result = await refreshSession(
      String(refreshToken ?? ''),
      deviceLabel ? String(deviceLabel) : undefined,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user.
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId },
      select: {
        id: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        mustChangePassword: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });
    if (!user) throw ApiError.unauthorized();
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

import {
  changeOwnPassword,
  deleteOwnAccount,
} from './auth.service';

/**
 * POST /api/v1/auth/change-password
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const { currentPassword, newPassword } = req.body ?? {};
    const result = await changeOwnPassword(
      req.auth.userId,
      currentPassword,
      newPassword,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/auth/me
 * Body: { password }
 * SRS 7.1
 */
router.delete('/me', authenticate, async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const { password } = req.body ?? {};
    const result = await deleteOwnAccount(req.auth.userId, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});



export default router;