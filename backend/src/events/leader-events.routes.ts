import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, authorize, touchLastActive } from '../auth/middleware';
import { leaderListEvents, createEvent, updateEvent, deleteEvent } from './events.service';
import { ApiError } from '../utils/ApiError';
import { reqEthDate } from '../funding/funding.validation';

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

router.use(authenticate, touchLastActive, authorize('LEADER', 'ADMIN'));

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await leaderListEvents();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  upload.fields([{ name: 'cover', maxCount: 1 }, { name: 'attachments', maxCount: 10 }]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const cover = files?.cover?.[0];
      const attachments = files?.attachments ?? [];

      const { title, description, location, publish } = req.body ?? {};
      const date = reqEthDate(req.body?.date, 'Date');

      const created = await createEvent(req.auth.userId, {
        title: String(title ?? ''),
        description: description ? String(description) : undefined,
        location: location ? String(location) : undefined,
        date,
        publish: String(publish ?? 'false') === 'true',
        coverImage: cover ? { buffer: cover.buffer, mimetype: cover.mimetype } : null,
        attachments: attachments.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype })),
      });
      res.status(201).json({ event: created });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  upload.fields([{ name: 'cover', maxCount: 1 }]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const cover = files?.cover?.[0];
      const { title, description, location, publish, removeCover } = req.body ?? {};
      const date = req.body?.date ? reqEthDate(req.body.date, 'Date') : undefined;

      const updated = await updateEvent(id, {
        title: title !== undefined ? String(title) : undefined,
        description: description !== undefined ? String(description) : null,
        location: location !== undefined ? String(location) : null,
        date,
        publish: publish !== undefined ? String(publish) === 'true' : undefined,
        removeCover: removeCover !== undefined ? String(removeCover) === 'true' : undefined,
        coverImage: cover ? { buffer: cover.buffer, mimetype: cover.mimetype } : null,
      });
      res.json({ event: updated });
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const result = await deleteEvent(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;