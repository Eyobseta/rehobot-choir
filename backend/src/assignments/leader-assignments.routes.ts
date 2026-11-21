import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, touchLastActive } from '../auth/middleware';
import { createAssignment, getLeaderAssignments, resolveReassignment, cancelAssignment, reassignAssignment } from './assignments.service';
import { ApiError } from '../utils/ApiError';
import { reqEthDate } from '../funding/funding.validation';
import { GatheringType, AssignmentRole } from '@prisma/client';

const router = Router();

router.use(authenticate, touchLastActive, authorize('LEADER', 'ADMIN'));

function parseGathering(v: unknown): GatheringType {
  if (v === 'TUESDAY_ZEMA' || v === 'THURSDAY_CHOIR' || v === 'SATURDAY_CHOIR' || v === 'SPECIAL_EVENT') {
    return v;
  }
  throw ApiError.badRequest('Invalid gathering type.');
}

function parseRole(v: unknown): AssignmentRole {
  if (v === 'PRAYER_LEADER' || v === 'WORSHIP_LEADER') {
    return v;
  }
  throw ApiError.badRequest('Invalid role.');
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getLeaderAssignments();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();

    const gatheringType = parseGathering(req.body?.gatheringType);
    const role = parseRole(req.body?.role);
    const assignedUserId = String(req.body?.assignedUserId ?? '');
    const customGatheringName = req.body?.customGatheringName ? String(req.body.customGatheringName) : undefined;
    const date = reqEthDate(req.body?.date, 'date');

    if (!assignedUserId) throw ApiError.badRequest('assignedUserId is required.');

    const assignment = await createAssignment(req.auth.userId, {
      gatheringType,
      customGatheringName,
      date,
      role,
      assignedUserId,
    });

    res.json({ assignment });
  } catch (err) {
    next(err);
  }
});

// 🟢 Reassign endpoint (Fixed TypeScript Error)
router.patch('/requests/:requestId/reassign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    
    // 👇 Added the type check here to fix the red squiggly line
    const requestId = req.params.requestId;
    if (typeof requestId !== 'string') throw ApiError.badRequest('Invalid ID.');
    
    const newUserId = String(req.body?.newUserId ?? '');

    if (!newUserId) throw ApiError.badRequest('newUserId is required.');

    const result = await reassignAssignment(req.auth.userId, requestId, newUserId);
    res.json({ success: true, assignment: result });
  } catch (err) {
    next(err);
  }
});

router.patch('/requests/:requestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    
    const requestId = req.params.requestId;
    if (typeof requestId !== 'string') throw ApiError.badRequest('Invalid ID.');

    const status = req.body?.status;
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw ApiError.badRequest('status must be APPROVED or REJECTED.');
    }

    const result = await resolveReassignment(req.auth.userId, requestId, status);
    res.json({ request: result });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid ID.');

    const result = await cancelAssignment(req.auth.userId, id);
    res.json({ assignment: result });
  } catch (err) {
    next(err);
  }
});

export default router;