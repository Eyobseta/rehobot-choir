import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  authenticate,
  touchLastActive,
} from '../auth/middleware';
import {
  listMembers,
  getMemberProfile,
  getOwnProfile,
  updateOwnProfile,
  updateOwnProfilePhoto,
  listBirthdaysWithPosts,
} from './members.service';
import { uploadBuffer, deleteByPublicId } from '../storage/cloudinary';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';


const router = Router();

// Every route requires auth; every request touches lastActive.
router.use(authenticate, touchLastActive);

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
 * GET /api/v1/members?search=...
 * Directory (SRS 18).
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = String(req.query.search ?? '');
    const items = await listMembers(search);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/members/:id
 * A single member profile (SRS 17.3).
 */
/**
 * GET /api/v1/members/birthdays
 * Today and tomorrow birthdays.
 */
router.get(
  '/birthdays',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
            const result = await listBirthdaysWithPosts(req.auth.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const profile = await getMemberProfile(req.auth.userId, id);
    res.json({ member: profile });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/members/me/profile
 * Own profile (SRS 17.1 / 17.2).
 */
router.get('/me/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const profile = await getOwnProfile(req.auth.userId);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/members/me/profile
 * Update editable fields only.
 */
router.patch('/me/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const profile = await updateOwnProfile(req.auth.userId, req.body ?? {});
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/members/me/profile/photo
 * multipart/form-data with field "photo".
 */
router.post(
  '/me/profile/photo',
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      if (!req.file) throw ApiError.badRequest('Photo is required.');

      // Upload new photo.
      const uploaded = await uploadBuffer(
        req.file.buffer,
        'rehobot/profile-photos',
        `me_${req.auth.userId}`,
      );

      // Delete old photo best-effort.
      const existing = await prisma.memberProfile.findUnique({
        where: { userId: req.auth.userId },
        select: { profilePhotoPublicId: true },
      });
      if (existing?.profilePhotoPublicId) {
        await deleteByPublicId(existing.profilePhotoPublicId);
      }

      const result = await updateOwnProfilePhoto(
        req.auth.userId,
        uploaded.url,
        uploaded.publicId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;