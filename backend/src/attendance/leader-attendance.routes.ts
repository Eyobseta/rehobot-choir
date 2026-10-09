import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticate,
  authorize,
  touchLastActive,
} from '../auth/middleware';
import {
  getAttendanceForDate,
  recordAttendance,
  getMemberAttendanceHistory,
  getGridSummary,
  getMyGridSummary,
} from './attendance.service';
import { GatheringType, AttendanceStatus } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

const router = Router();

router.use(authenticate, touchLastActive, authorize('LEADER', 'ADMIN'));

function parseGathering(v: unknown): GatheringType {
  if (
    v === 'TUESDAY_ZEMA' ||
    v === 'THURSDAY_CHOIR' ||
    v === 'SATURDAY_CHOIR'
  ) {
    return v;
  }
  throw ApiError.badRequest('Invalid gathering.');
}

function requireDate(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw ApiError.badRequest('date must be YYYY-MM-DD.');
  }
  return s;
}

/**
 * GET /api/v1/leaders/attendance/grid?gathering=&from=&to=
 *
 * IMPORTANT: declared before '/:id'-style routes. This router has
 * '/', '/grid', and '/members/:id' — none collide because '/grid' is a
 * literal, not a param.
 */
router.get(
  '/grid',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gathering = parseGathering(req.query.gathering);
      const to = String(
        req.query.to ?? new Date().toISOString().slice(0, 10),
      );
      const from = String(
        req.query.from ??
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
      );
      const data = await getGridSummary(gathering, from, to);
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/leaders/attendance?gathering=...&date=YYYY-MM-DD
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gathering = parseGathering(req.query.gathering);
      const date = requireDate(req.query.date);
      const data = await getAttendanceForDate(gathering, date);
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/leaders/attendance
 * Body: { gathering, date, records: [{ memberId, status }] }
 */
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const gathering = parseGathering(req.body?.gathering);
      const date = requireDate(req.body?.date);
      const rawRecords = Array.isArray(req.body?.records)
        ? (req.body.records as { memberId: unknown; status: unknown }[])
        : [];

      const records = rawRecords.map((r) => ({
        memberId: String(r.memberId ?? ''),
        status: r.status as AttendanceStatus,
      }));

      const result = await recordAttendance(req.auth.userId, {
        gathering,
        date,
        records,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/leaders/attendance/members/:id
 */
router.get(
  '/members/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
      const limit = Number(req.query.limit ?? 60);
      const items = await getMemberAttendanceHistory(id, limit);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/leaders/attendance/members/:id/grid
 */
router.get(
  '/members/:id/grid',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
      const to = String(
        req.query.to ?? new Date().toISOString().slice(0, 10),
      );
      const from = String(
        req.query.from ??
          new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10),
      );
      const data = await getMyGridSummary(id, from, to);
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

export default router;