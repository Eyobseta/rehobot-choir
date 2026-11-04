import { Router } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import { ApiError } from '../utils/ApiError';
import {
  listEntriesForRole,
  getKbVersion,
  logQuery,
  recordFeedback,
} from './help.service';

const router = Router();
router.use(authenticate, touchLastActive);

/** GET /api/v1/help/entries — role-filtered KB for the caller. */
router.get('/entries', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const items = await listEntriesForRole(req.auth.role);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/** GET /api/v1/help/entries/version — cheap "has the KB changed?" check. */
router.get('/entries/version', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json({ version: await getKbVersion(req.auth.role) });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/help/query-log
 * Body: { screen?, language, rawQuery?, matchedEntryId?, matchScore? }
 * Fire-and-forget from the client — never blocking.
 */
router.post('/query-log', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const out = await logQuery(req.auth.userId, req.auth.role, {
      screen: req.body?.screen ? String(req.body.screen) : undefined,
      language: String(req.body?.language ?? 'en'),
      rawQuery: req.body?.rawQuery ? String(req.body.rawQuery) : undefined,
      matchedEntryId: req.body?.matchedEntryId
        ? String(req.body.matchedEntryId)
        : undefined,
      matchScore:
        typeof req.body?.matchScore === 'number'
          ? req.body.matchScore
          : undefined,
    });
    res.status(201).json({ id: out.id });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/help/query-log/:id/feedback
 * Body: { feedback: 'UP'|'DOWN'|'NONE', note? }
 */
router.post('/query-log/:id/feedback', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');

    const raw = String(req.body?.feedback ?? '').toUpperCase();
    if (raw !== 'UP' && raw !== 'DOWN' && raw !== 'NONE') {
      throw ApiError.badRequest('feedback must be UP, DOWN, or NONE.');
    }
    const out = await recordFeedback(req.auth.userId, id, raw);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

export default router;