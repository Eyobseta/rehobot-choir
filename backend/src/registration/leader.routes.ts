import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../auth/middleware';
import {
  listPending,
  getApplication,
  approveApplication,
  rejectApplication,
} from './registration.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

router.use(authenticate, authorize('LEADER', 'ADMIN'));

function paramId(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id.trim() === '') {
    throw ApiError.badRequest('Application id is required.');
  }
  return id;
}

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await listPending();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await getApplication(paramId(req));
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/approve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const result = await approveApplication(paramId(req), req.auth.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/reject',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const reason = String(req.body?.reason ?? '');
      const result = await rejectApplication(
        paramId(req),
        req.auth.userId,
        reason,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;