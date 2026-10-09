import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticate,
  touchLastActive,
} from '../auth/middleware';
import {
  listPublishedSongs,
  getPublishedSong,
  listCategories,
  favoriteSong,
  unfavoriteSong,
  listMyFavorites,
} from './songs.service';
import { ApiError } from '../utils/ApiError';

const router = Router();
router.use(authenticate, touchLastActive);

router.get('/categories', async (_req, res, next) => {
  try {
    const items = await listCategories();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/favorites/me', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const items = await listMyFavorites(req.auth.userId);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '');
    const items = await listPublishedSongs(search);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const item = await getPublishedSong(id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/favorite', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const result = await favoriteSong(id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/favorite', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const result = await unfavoriteSong(id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;