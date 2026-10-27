import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../auth/middleware';
import {
  findMemberByPhone,
  leaderResetMemberPassword,
  leaderDeleteMember,
  leaderAppointMember,
} from '../auth/auth.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

router.use(authenticate, authorize('LEADER', 'ADMIN'));

function paramId(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id.trim() === '') {
    throw ApiError.badRequest('Member id is required.');
  }
  return id;
}

router.get(
  '/lookup',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const phone = String(req.query.phone ?? '');
      const member = await findMemberByPhone(phone);
      res.json({ member });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/reset-password',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      
      // Read the custom password from the body
      const newPassword = req.body?.newPassword ? String(req.body.newPassword) : undefined;

      const result = await leaderResetMemberPassword(
        req.auth.userId,
        paramId(req),
        newPassword, // Pass it in
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/:id/appoint',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const result = await leaderAppointMember(
        req.auth.userId,
        paramId(req),
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const { leaderPassword } = req.body ?? {};
      const result = await leaderDeleteMember(
        req.auth.userId,
        paramId(req),
        leaderPassword,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;