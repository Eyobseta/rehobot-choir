import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import {
  getTodayQuote,
  listRecentQuotes,
  getMyQuoteCount,
  publishTodayQuote,
} from './quotes.service';
import { ApiError } from '../utils/ApiError';
import { singleAudioUpload } from '../utils/uploadLimits';

const router = Router();

router.use(authenticate, touchLastActive);

/**
 * GET /api/v1/quotes/today
 */
router.get('/today', async (_req, res, next) => {
  try {
    const item = await getTodayQuote();
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/quotes/recent?days=7
 */
router.get('/recent', async (req, res, next) => {
  try {
    const days = Number(req.query.days ?? 7);
    const items = await listRecentQuotes(Number.isFinite(days) ? days : 7);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/v1/quotes/mine/count
 */
router.get('/mine/count', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const result = await getMyQuoteCount(req.auth.userId);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/quotes
 * multipart/form-data:
 *   quoteText, source, youtubeUrl?, audio? (file, max 8 MB)
 */
router.post(
  '/',
  singleAudioUpload(8),
  async (req, res, next) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const { quoteText, source, youtubeUrl } = req.body ?? {};
      const created = await publishTodayQuote(req.auth.userId, {
        quoteText: String(quoteText ?? ''),
        source: String(source ?? ''),
        youtubeUrl: youtubeUrl ? String(youtubeUrl) : undefined,
        audio: req.file
          ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
          : null,
      });
      res.status(201).json({ quote: created });
    } catch (e) {
      next(e);
    }
  },
);

export default router;