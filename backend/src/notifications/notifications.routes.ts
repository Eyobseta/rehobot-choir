import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import {
  listMyNotifications,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
  registerPushToken,
  unregisterPushToken,
} from './notifications.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

router.use(authenticate, touchLastActive);

// ---------- Inbox ----------

router.get('/', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const limit = Number(req.query.limit ?? 60);
    const items = await listMyNotifications(
      req.auth.userId,
      Number.isFinite(limit) ? limit : 60,
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/read', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    res.json(await markNotificationRead(req.auth.userId, id));
  } catch (e) {
    next(e);
  }
});

router.post('/read-all', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await markAllRead(req.auth.userId));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    res.json(await deleteNotification(req.auth.userId, id));
  } catch (e) {
    next(e);
  }
});

// ---------- Preferences ----------

router.get('/preferences', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await getPreferences(req.auth.userId));
  } catch (e) {
    next(e);
  }
});

router.patch('/preferences', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await updatePreferences(req.auth.userId, req.body ?? {}));
  } catch (e) {
    next(e);
  }
});

// ---------- Push token ----------

router.post('/register-token', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const { token, platform, deviceLabel } = req.body ?? {};
    const result = await registerPushToken(
      req.auth.userId,
      String(token ?? ''),
      String(platform ?? ''),
      deviceLabel ? String(deviceLabel) : undefined,
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/unregister-token', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const token = String(req.body?.token ?? '');
    if (!token) throw ApiError.badRequest('Token is required.');
    res.json(await unregisterPushToken(token));
  } catch (e) {
    next(e);
  }
});

export default router;