import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import {
  getMyAttendanceHistory,
  getMyGridSummary,
} from './attendance.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

router.use(authenticate, touchLastActive);

/**
 * GET /api/v1/attendance/grid/me?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * IMPORTANT: must be declared BEFORE '/me', otherwise Express will
 * match '/grid' as a path param of nothing — but for clarity of intent
 * we place the more specific route first.
 */
router.get(
  '/grid/me',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const to = String(
        req.query.to ?? new Date().toISOString().slice(0, 10),
      );
      const from = String(
        req.query.from ??
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
      );
      const data = await getMyGridSummary(req.auth.userId, from, to);
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/attendance/me
 * Own history (SRS 12.3).
 */
router.get(
  '/me',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const limit = Number(req.query.limit ?? 60);
      const items = await getMyAttendanceHistory(req.auth.userId, limit);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

export default router;