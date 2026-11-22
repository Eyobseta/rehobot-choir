import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, touchLastActive } from '../auth/middleware';
import {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  leaderListSongs,
  leaderGetSongById,
  createSong,
  updateSong,
  deleteSong,
  listZemaMembers,
  addZemaMember,
  removeZemaMember,
  listPendingSubmissions,
  approveSubmission,
  returnSubmission,
} from './songs.service';
import { ocrUpload, scanLyricsHandler } from './ocr.service';
import { ApiError } from '../utils/ApiError';
import { singleAudioUpload } from '../utils/uploadLimits';

const router = Router();

router.use(authenticate, touchLastActive, authorize('LEADER', 'ADMIN'));

// --- Lyrics OCR (photo → text) ---
router.post('/ocr', ocrUpload.array('images', 4), scanLyricsHandler);

// --- Categories ---
router.get('/song-categories', async (_req, res, next) => {
  try {
    res.json({ items: await listCategories() });
  } catch (e) { next(e); }
});
router.post('/song-categories', async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '');
    res.status(201).json({ category: await createCategory(name) });
  } catch (e) { next(e); }
});
router.patch('/song-categories/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const name = String(req.body?.name ?? '');
    res.json({ category: await renameCategory(id, name) });
  } catch (e) { next(e); }
});
router.delete('/song-categories/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    res.json(await deleteCategory(id));
  } catch (e) { next(e); }
});

// --- Songs ---
router.get('/songs', async (_req, res, next) => {
  try {
    res.json({ items: await leaderListSongs() });
  } catch (e) { next(e); }
});

router.post(
  '/songs',
  singleAudioUpload(10), // audio max 10 MB
  async (req, res, next) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const { title, lyrics, youtubeUrl, categoryId, publish } = req.body ?? {};
      const created = await createSong(req.auth.userId, {
        title: String(title ?? ''),
        lyrics: lyrics ? String(lyrics) : undefined,
        youtubeUrl: youtubeUrl ? String(youtubeUrl) : undefined,
        categoryId: categoryId ? String(categoryId) : null,
        publish: String(publish ?? 'false') === 'true',
        audio: req.file
          ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
          : null,
      });
      res.status(201).json({ song: created });
    } catch (e) { next(e); }
  },
);


/**
 * GET /api/v1/leaders/songs/:id
 * Returns a song in any status except DELETED.
 */
router.get('/songs/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const item = await leaderGetSongById(id);
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.patch(
  '/songs/:id',
  singleAudioUpload(10), // audio max 10 MB
  async (req, res, next) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
      const { title, lyrics, youtubeUrl, categoryId, publish, unpublish, removeAudio } = req.body ?? {};
      const updated = await updateSong(id, {
        title: title !== undefined ? String(title) : undefined,
        lyrics: lyrics !== undefined ? String(lyrics) : undefined,
        youtubeUrl: youtubeUrl !== undefined ? String(youtubeUrl) : undefined,
        categoryId: categoryId !== undefined ? String(categoryId) : undefined,
        publish: publish !== undefined ? String(publish) === 'true' : undefined,
        unpublish: unpublish !== undefined ? String(unpublish) === 'true' : undefined,
        removeAudio: removeAudio !== undefined ? String(removeAudio) === 'true' : undefined,
        audio: req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : null,
      });
      res.json({ song: updated });
    } catch (e) { next(e); }
  },
);

router.delete('/songs/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    res.json(await deleteSong(id));
  } catch (e) { next(e); }
});

// --- Zema Team ---
router.get('/zema-members', async (_req, res, next) => {
  try {
    res.json({ items: await listZemaMembers() });
  } catch (e) { next(e); }
});
router.post('/zema-members/:userId', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const userId = req.params.userId;
    if (typeof userId !== 'string') throw ApiError.badRequest('Invalid userId.');
    res.json(await addZemaMember(req.auth.userId, userId));
  } catch (e) { next(e); }
});
router.delete('/zema-members/:userId', async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (typeof userId !== 'string') throw ApiError.badRequest('Invalid userId.');
    res.json(await removeZemaMember(userId));
  } catch (e) { next(e); }
});

// --- Song submissions (review queue) ---
router.get('/song-submissions', async (_req, res, next) => {
  try {
    res.json({ items: await listPendingSubmissions() });
  } catch (e) { next(e); }
});
router.post('/song-submissions/:id/approve', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    res.json(await approveSubmission(id));
  } catch (e) { next(e); }
});
router.post('/song-submissions/:id/return', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const reason = String(req.body?.reason ?? '');
    res.json(await returnSubmission(id, reason));
  } catch (e) { next(e); }
});

export default router;