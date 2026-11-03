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
 *
 * `from` and `to` are optional Ethiopian date JSON objects:
 *   ?from={"year":2016,"month":1,"day":1}&to={"year":2016,"month":12,"day":30}
 *
 * If either is provided but malformed or out of range, reqEthDate throws a
 * specific 400 (DATE_REQUIRED / INVALID_DATE_FORMAT / INVALID_ETHIOPIAN_DATE)
 * instead of silently falling back to the default window.
 */
router.get('/grid/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();

    const today = ethTodayFromInstant(new Date());
    const threeMonthsAgo = {
      year: today.year,
      month: Math.max(1, today.month - 3),
      day: 1,
    };

    let from = threeMonthsAgo;
    let to = today;

    if (req.query.from) {
      from = reqEthDate(req.query.from, 'from');
    }
    if (req.query.to) {
      to = reqEthDate(req.query.to, 'to');
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