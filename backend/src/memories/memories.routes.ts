import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, touchLastActive } from '../auth/middleware';
import {
  listPublishedMemories,
  listMemoryYears,
  getPublishedMemory,
  submitMemory,
  listMyMemories,
} from './memories.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

router.use(authenticate, touchLastActive);

// ----- Public listings -----

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '');
    const items = await listPublishedMemories(search);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/years', async (_req, res, next) => {
  try {
    const items = await listMemoryYears();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/mine', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const items = await listMyMemories(req.auth.userId);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const item = await getPublishedMemory(id);
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

// ----- Submission -----

router.post(
  '/',
  upload.fields([
    { name: 'photos', maxCount: 20 },
    { name: 'audio', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const { title, description, date, youtubeUrls } = req.body ?? {};

      const files = req.files as
        | Record<string, Express.Multer.File[]>
        | undefined;
      const photos = files?.photos ?? [];
      const audio = files?.audio?.[0];

      let youtubeList: string[] | undefined;
      if (youtubeUrls) {
        try {
          youtubeList = JSON.parse(String(youtubeUrls));
        } catch {
          throw ApiError.badRequest('youtubeUrls must be valid JSON.');
        }
      }

      const created = await submitMemory(req.auth.userId, {
        title: String(title ?? ''),
        description: description ? String(description) : undefined,
        date: String(date ?? ''),
        photos: photos.map((f) => ({
          buffer: f.buffer,
          mimetype: f.mimetype,
        })),
        audio: audio
          ? { buffer: audio.buffer, mimetype: audio.mimetype }
          : null,
        youtubeUrls: youtubeList,
      });
      res.status(201).json({ memory: created });
    } catch (e) {
      next(e);
    }
  },
);

export default router;