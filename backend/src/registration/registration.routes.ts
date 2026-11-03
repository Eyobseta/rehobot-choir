import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { register, getStatus } from './registration.service';
import { ApiError } from '../utils/ApiError';
import { reqEthDate, optEthDate } from '../funding/funding.validation';

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
 * POST /api/v1/auth/register — public
 * multipart/form-data with fields + photo.
 *
 * Date fields (dateOfBirth, joiningDate) must be a JSON object string like
 * '{"year":2016,"month":1,"day":1}' in the Ethiopian calendar. Validated by
 * reqEthDate / optEthDate so a bad date returns 400 with a specific code
 * instead of crashing the request with a 500.
 */
router.post(
  '/register',
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw ApiError.badRequest('Profile photo is required.');

      const body = req.body ?? {};

      // Validate Ethiopian dates up front — before any DB or storage work.
      const dateOfBirth = reqEthDate(body.dateOfBirth, 'Date of birth');
      const joiningDate = optEthDate(body.joiningDate, 'Joining date');

      const result = await register({
        fullName: String(body.fullName ?? ''),
        phone: String(body.phone ?? ''),
        email: String(body.email ?? ''),
        password: String(body.password ?? ''),
        gender: String(body.gender ?? ''),
        dateOfBirth,
        emergencyContactName: String(body.emergencyContactName ?? ''),
        emergencyContactPhone: String(body.emergencyContactPhone ?? ''),
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