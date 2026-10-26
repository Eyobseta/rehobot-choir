// src/attendance/attendance.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import { getMyAttendanceHistory, getMyGridSummary } from './attendance.service';
import { ApiError } from '../utils/ApiError';
import { reqEthDate } from '../funding/funding.validation';
import { ethTodayFromInstant } from '../utils/ethiopianCalendar';

const router = Router();

router.use(authenticate, touchLastActive);

/**
 * GET /api/v1/attendance/grid/me?from={json}&to={json}
 */
router.get('/grid/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();

    const today = ethTodayFromInstant(new Date());
    const threeMonthsAgo = { year: today.year, month: Math.max(1, today.month - 3), day: 1 };

    let from = threeMonthsAgo;
    let to = today;

    // FIXED: Safe parsing with try/catch
    if (req.query.from) {
      try {
        from = reqEthDate(JSON.parse(String(req.query.from)), 'from');
      } catch {
        // ignore, use default
      }
    }
    if (req.query.to) {
      try {
        to = reqEthDate(JSON.parse(String(req.query.to)), 'to');
      } catch {
        // ignore, use default
      }
    }

    const data = await getMyGridSummary(req.auth.userId, from, to);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const limit = Number(req.query.limit ?? 60);
    const items = await getMyAttendanceHistory(req.auth.userId, limit);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

export default router;