// src/attendance/leader-attendance.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, touchLastActive } from '../auth/middleware';
import {
  getAttendanceForDate,
  recordAttendance,
  getMemberAttendanceHistory,
  getGridSummary,
  getMyGridSummary,
} from './attendance.service';
import { GatheringType, AttendanceStatus } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { reqEthDate } from '../funding/funding.validation';
import { ethTodayFromInstant } from '../utils/ethiopianCalendar';

const router = Router();

router.use(authenticate, touchLastActive, authorize('LEADER', 'ADMIN'));

function parseGathering(v: unknown): GatheringType {
  if (v === 'TUESDAY_ZEMA' || v === 'THURSDAY_CHOIR' || v === 'SATURDAY_CHOIR') {
    return v;
  }
  throw ApiError.badRequest('Invalid gathering.');
}

router.get('/grid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gathering = parseGathering(req.query.gathering);
    const today = ethTodayFromInstant(new Date());
    const threeMonthsAgo = {
      year: today.year,
      month: Math.max(1, today.month - 3),
      day: 1,
    };

    let from = threeMonthsAgo;
    let to = today;

    // reqEthDate handles JSON-object strings natively; bad input surfaces as a
    // specific 400 instead of being silently replaced with defaults.
    if (req.query.from) {
      from = reqEthDate(req.query.from, 'from');
    }
    if (req.query.to) {
      to = reqEthDate(req.query.to, 'to');
    }

    const data = await getGridSummary(gathering, from, to);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gathering = parseGathering(req.query.gathering);
    const date = reqEthDate(req.query.date, 'date');

    const data = await getAttendanceForDate(gathering, date);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const gathering = parseGathering(req.body?.gathering);
    const date = reqEthDate(req.body?.date, 'date');

    const rawRecords = Array.isArray(req.body?.records)
      ? (req.body.records as { memberId: unknown; status: unknown }[])
      : [];

    const records = rawRecords.map((r) => ({
      memberId: String(r.memberId ?? ''),
      status: r.status as AttendanceStatus,
    }));

    const result = await recordAttendance(req.auth.userId, { gathering, date, records });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/members/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const limit = Number(req.query.limit ?? 60);
    const items = await getMemberAttendanceHistory(id, limit);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// ========== Member grid for leaders ==========
router.get('/members/:id/grid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');

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

    const data = await getMyGridSummary(id, from, to);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;