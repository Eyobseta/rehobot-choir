import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, touchLastActive } from '../auth/middleware';
import {
  listPublishedEvents,
  getEventDetail,
  setRsvp,
  clearRsvp,
} from './events.service';
import { RsvpResponse } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { reqEthDate } from '../funding/funding.validation'; // Reusing the validation helper

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(ApiError.badRequest('Only image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticate, touchLastActive);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = String(req.query.scope ?? 'upcoming');
    if (scope !== 'upcoming' && scope !== 'past') {
      throw ApiError.badRequest('scope must be "upcoming" or "past".');
    }
    const items = await listPublishedEvents(scope);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const detail = await getEventDetail(id);
    res.json({ event: detail });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/rsvp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');

    const response = String(req.body?.response ?? '') as RsvpResponse;
    if (response !== 'GOING' && response !== 'MAYBE' && response !== 'NOT_GOING') {
      throw ApiError.badRequest('response must be GOING, MAYBE, or NOT_GOING.');
    }
    const rsvp = await setRsvp(id, req.auth.userId, response);
    res.json({ rsvp });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/rsvp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const result = await clearRsvp(id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;