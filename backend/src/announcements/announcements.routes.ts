import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import {
  listPublishedAnnouncements,
  getAnnouncementDetail,
} from './announcements.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

router.use(authenticate, touchLastActive);

/**
 * GET /api/v1/announcements?search=...
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = String(req.query.search ?? '');
      const items = await listPublishedAnnouncements(search);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/announcements/:id
 */
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
      const item = await getAnnouncementDetail(id);
      res.json({ item });
    } catch (err) {
      next(err);
    }
  },
);

export default router;