import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import { getMyAssignments, requestReassignment } from './assignments.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

router.use(authenticate, touchLastActive);

/**
 * GET /api/v1/assignments/me
 * Fetch upcoming assignments for the Home Screen
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const items = await getMyAssignments(req.auth.userId);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/assignments/:id/reassign-request
 * Body: { reason: string }
 */
router.post('/:id/reassign-request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid ID.');
    
    const reason = String(req.body?.reason ?? '');
    const request = await requestReassignment(req.auth.userId, id, reason);
    
    res.json({ request });
  } catch (err) {
    next(err);
  }
});

export default router;