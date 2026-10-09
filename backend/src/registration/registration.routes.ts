import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { register, getStatus } from './registration.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(ApiError.badRequest('Only image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/v1/auth/register  — public
 * multipart/form-data with fields + photo
 */
router.post(
  '/register',
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw ApiError.badRequest('Profile photo is required.');

      const {
        fullName,
        phone,
        email,
        password,
        gender,
        dateOfBirth,
        emergencyContactName,
        emergencyContactPhone,
        joiningDate,
      } = req.body ?? {};

      const result = await register({
        fullName,
        phone,
        email,
        password,
        gender,
        dateOfBirth,
        emergencyContactName,
        emergencyContactPhone,
        joiningDate,
        photo: { buffer: req.file.buffer, mimetype: req.file.mimetype },
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/auth/registration-status?phone=...
 */
router.get(
  '/registration-status',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const phone = String(req.query.phone ?? '');
      const result = await getStatus(phone);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;