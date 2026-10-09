import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, authorize, touchLastActive } from '../auth/middleware';
import {
  leaderListAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from './announcements.service';
import { ApiError } from '../utils/ApiError';

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

/**
 * GET /api/v1/leaders/announcements
 */
router.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await leaderListAnnouncements();
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/leaders/announcements
 * multipart/form-data:
 *   title, message, publishAt (ISO, optional), eventId?, publish ("true"/"false"),
 *   songs (JSON string, optional — array of { songId, songTitle })
 *   image (file, optional)
 */
router.post(
  '/',
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const { title, message, publishAt, eventId, publish, songs } =
        req.body ?? {};

      let songIds: { songId: string; songTitle: string }[] | undefined;
      if (songs) {
        try {
          songIds = JSON.parse(String(songs));
        } catch {
          throw ApiError.badRequest('songs must be valid JSON.');
        }
      }

      const created = await createAnnouncement(req.auth.userId, {
        title: String(title ?? ''),
        message: String(message ?? ''),
        publishAt: publishAt ? String(publishAt) : undefined,
        eventId: eventId ? String(eventId) : null,
        publish: String(publish ?? 'false') === 'true',
        songIds,
        image: req.file
          ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
          : null,
      });
      res.status(201).json({ announcement: created });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/v1/leaders/announcements/:id
 */
router.patch(
  '/:id',
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
      const {
        title,
        message,
        publishAt,
        eventId,
        publish,
        removeImage,
        songs,
      } = req.body ?? {};

      let songIds: { songId: string; songTitle: string }[] | undefined;
      if (songs) {
        try {
          songIds = JSON.parse(String(songs));
        } catch {
          throw ApiError.badRequest('songs must be valid JSON.');
        }
      }

      const updated = await updateAnnouncement(id, {
        title: title !== undefined ? String(title) : undefined,
        message: message !== undefined ? String(message) : undefined,
        publishAt: publishAt !== undefined ? String(publishAt) : undefined,
        eventId: eventId !== undefined ? String(eventId) : undefined,
        publish:
          publish !== undefined ? String(publish) === 'true' : undefined,
        removeImage:
          removeImage !== undefined ? String(removeImage) === 'true' : undefined,
        songIds,
        image: req.file
          ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
          : null,
      });
      res.json({ announcement: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/leaders/announcements/:id
 */
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
      const result = await deleteAnnouncement(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;