import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, touchLastActive } from '../auth/middleware';
import {
  isZemaMember,
  listMySubmissions,
  saveSubmissionDraft,
  submitForReview,
} from './songs.service';
import { ocrUpload, scanLyricsHandler } from './Ocr.service';
import { ApiError } from '../utils/ApiError';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(authenticate, touchLastActive);

/**
 * Every route requires Zema membership.
 */
router.use(async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const ok = await isZemaMember(req.auth.userId);
    if (!ok) throw ApiError.forbidden('Not a Zema Team member.');
    next();
  } catch (e) {
    next(e);
  }
});

router.get('/submissions/me', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json({ items: await listMySubmissions(req.auth.userId) });
  } catch (e) { next(e); }
});

router.post('/submissions', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const { submissionId, title, lyrics, youtubeUrl, categoryId } = req.body ?? {};
    const result = await saveSubmissionDraft(req.auth.userId, {
      submissionId: submissionId ? String(submissionId) : null,
      title: String(title ?? ''),
      lyrics: lyrics ? String(lyrics) : undefined,
      youtubeUrl: youtubeUrl ? String(youtubeUrl) : undefined,
      categoryId: categoryId ? String(categoryId) : null,
      audio: req.file
        ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
        : null,
    });
    res.json(result);
  } catch (e) { next(e); }
});

// Scan handwritten / printed lyrics from photos → text (Gemini free tier)
router.post('/ocr', ocrUpload.array('images', 4), scanLyricsHandler);

router.post('/submissions/:id/submit', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    res.json(await submitForReview(req.auth.userId, id));
  } catch (e) { next(e); }
});

export default router;