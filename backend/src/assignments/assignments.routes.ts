import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import { getChoirAssignments, requestReassignment } from './assignments.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

router.use(authenticate, touchLastActive);

// 🟢 NEW: Fetch all upcoming choir assignments
router.get('/choir', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await getChoirAssignments();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

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