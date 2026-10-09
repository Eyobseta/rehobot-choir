import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import {
  getBirthdayPostDetail,
  setReaction,
  removeReaction,
  addComment,
  deleteComment,
  likeComment,
  unlikeComment,
} from './birthdays.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

router.use(authenticate, touchLastActive);

/**
 * GET /api/v1/birthdays/posts/:id
 */
router.get('/posts/:id', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const post = await getBirthdayPostDetail(id, req.auth.userId);
    res.json({ post });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/birthdays/posts/:id/reaction
 * Body: { emoji }
 */
router.post('/posts/:id/reaction', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const emoji = String(req.body?.emoji ?? '');
    res.json(await setReaction(id, req.auth.userId, emoji));
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/v1/birthdays/posts/:id/reaction
 */
router.delete('/posts/:id/reaction', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    res.json(await removeReaction(id, req.auth.userId));
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/birthdays/posts/:id/comments
 * Body: { text, parentCommentId? }
 */
router.post('/posts/:id/comments', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const text = String(req.body?.text ?? '');
    const parentCommentId = req.body?.parentCommentId
      ? String(req.body.parentCommentId)
      : null;
    const result = await addComment(
      id,
      req.auth.userId,
      text,
      parentCommentId,
    );
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/v1/birthdays/comments/:id
 */
router.delete('/comments/:id', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const isLeader =
      req.auth.role === 'LEADER' || req.auth.role === 'ADMIN';
    res.json(await deleteComment(id, req.auth.userId, isLeader));
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/birthdays/comments/:id/like
 */
router.post('/comments/:id/like', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    res.json(await likeComment(id, req.auth.userId));
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/v1/birthdays/comments/:id/like
 */
router.delete('/comments/:id/like', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    res.json(await unlikeComment(id, req.auth.userId));
  } catch (e) {
    next(e);
  }
});

export default router;