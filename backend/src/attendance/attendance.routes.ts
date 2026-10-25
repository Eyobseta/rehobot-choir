import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import { getMyAttendanceHistory, getMyGridSummary } from './attendance.service';
import { ApiError } from '../utils/ApiError';
import { reqEthDate } from '../funding/funding.validation';

const router = Router();

router.use(authenticate, touchLastActive);

/**
 * GET /api/v1/attendance/grid/me?from=YYYY-MM-DD&to=YYYY-MM-DD
 * NOTE: In the mobile app, you should now pass from/to as E.C. objects,
 * e.g., ?from={"year":2016,"month":1,"day":1}
 */
router.get('/grid/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    
    // Fallback to today's E.C. date if not passed
    const today = new Date();
    const defaultEth = { year: today.getFullYear() - 8, month: 1, day: 1 }; // Rough fallback
    
    const from = req.query.from ? reqEthDate(JSON.parse(String(req.query.from)), 'from') : defaultEth;
    const to = req.query.to ? reqEthDate(JSON.parse(String(req.query.to)), 'to') : defaultEth;

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