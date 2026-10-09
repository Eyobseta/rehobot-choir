import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, authorize, touchLastActive } from '../auth/middleware';
import {
  leaderListPendingMemories,
  leaderGetMemory,
  approveMemory,
  rejectMemory,
  editMemory,
  deleteMemory,
} from './memories.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(authenticate, touchLastActive, authorize('LEADER', 'ADMIN'));

router.get('/pending', async (_req, res, next) => {
  try {
    const items = await leaderListPendingMemories();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const item = await leaderGetMemory(id);
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/approve', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const result = await approveMemory(id, req.auth.userId);
    res.json({ memory: result });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const reason = req.body?.reason ? String(req.body.reason) : undefined;
    const result = await rejectMemory(id, req.auth.userId, reason);
    res.json({ memory: result });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/:id',
  upload.fields([
    { name: 'photos', maxCount: 20 },
    { name: 'audio', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');

      const files = req.files as
        | Record<string, Express.Multer.File[]>
        | undefined;
      const photos = files?.photos ?? [];
      const audio = files?.audio?.[0];
      const { title, description, date, youtubeUrls, replaceMedia } =
        req.body ?? {};

      let youtubeList: string[] | undefined;
      if (youtubeUrls) {
        try {
          youtubeList = JSON.parse(String(youtubeUrls));
        } catch {
          throw ApiError.badRequest('youtubeUrls must be valid JSON.');
        }
      }

      const shouldReplace = String(replaceMedia ?? 'false') === 'true';

      const result = await editMemory(id, req.auth.userId, {
        title: title !== undefined ? String(title) : undefined,
        description: description !== undefined ? String(description) : undefined,
        date: date !== undefined ? String(date) : undefined,
        replaceMedia: shouldReplace
          ? {
              photos: photos.map((f) => ({
                buffer: f.buffer,
                mimetype: f.mimetype,
              })),
              audio: audio
                ? { buffer: audio.buffer, mimetype: audio.mimetype }
                : null,
              youtubeUrls: youtubeList ?? [],
            }
          : undefined,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const result = await deleteMemory(id);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;