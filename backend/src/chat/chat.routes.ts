import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, touchLastActive } from '../auth/middleware';
import {
  listConversations,
  getConversationDetail,
  openDirectConversation,
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  createGroup,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  deleteGroup,
} from './chat.service';
import { ApiError } from '../utils/ApiError';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB safety cap
});

router.use(authenticate, touchLastActive);

// ----------------------- Conversations -----------------------

router.get('/', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const items = await listConversations(req.auth.userId);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.post('/direct', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const otherUserId = String(req.body?.userId ?? '');
    if (!otherUserId) throw ApiError.badRequest('userId is required.');
    const result = await openDirectConversation(req.auth.userId, otherUserId);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const detail = await getConversationDetail(id, req.auth.userId);
    res.json({ conversation: detail });
  } catch (e) {
    next(e);
  }
});

// ----------------------- Messages -----------------------

router.get('/:id/messages', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const before = req.query.before ? String(req.query.before) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await listMessages(
      id,
      req.auth.userId,
      before,
      Number.isFinite(limit) ? limit : undefined,
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post(
  '/:id/messages',
  upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'voice', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');

      const files = req.files as
        | Record<string, Express.Multer.File[]>
        | undefined;
      const photos = files?.photos ?? [];
      const voiceFile = files?.voice?.[0];

      const text = req.body?.text;
      const replyToId = req.body?.replyToId ? String(req.body.replyToId) : null;
      const voiceDurationRaw = req.body?.voiceDurationSeconds;
      const voiceDuration = voiceDurationRaw ? Number(voiceDurationRaw) : 0;

      const message = await sendMessage(id, req.auth.userId, {
        text: text ? String(text) : undefined,
        replyToId,
        photos: photos.map((f) => ({
          buffer: f.buffer,
          mimetype: f.mimetype,
        })),
        voice: voiceFile
          ? {
              buffer: voiceFile.buffer,
              mimetype: voiceFile.mimetype,
              durationSeconds: voiceDuration,
            }
          : null,
      });
      res.status(201).json({ message });
    } catch (e) {
      next(e);
    }
  },
);

router.patch('/messages/:id', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const text = String(req.body?.text ?? '');
    const result = await editMessage(id, req.auth.userId, text);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.delete('/messages/:id', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const isLeader =
      req.auth.role === 'LEADER' || req.auth.role === 'ADMIN';
    const result = await deleteMessage(id, req.auth.userId, isLeader);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ----------------------- Groups -----------------------

/**
 * Parse a memberIds body field.
 * Accepts either a real array (json body) or a JSON-encoded array string
 * (multipart/form-data). Rejects anything else with a clear message.
 */
function parseMemberIdsField(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') return [];

  if (Array.isArray(raw)) {
    return raw.map((v) => String(v));
  }

  if (typeof raw === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw ApiError.badRequest(
        'memberIds must be a JSON array, e.g. ["id1","id2"].',
      );
    }
    if (!Array.isArray(parsed)) {
      throw ApiError.badRequest(
        'memberIds must be a JSON array, e.g. ["id1","id2"].',
      );
    }
    return parsed.map((v) => String(v));
  }

  throw ApiError.badRequest(
    'memberIds must be a JSON array, e.g. ["id1","id2"].',
  );
}

router.post(
  '/groups',
  upload.single('photo'),
  async (req, res, next) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      if (req.auth.role !== 'LEADER' && req.auth.role !== 'ADMIN') {
        throw ApiError.forbidden('Only leaders can create groups.');
      }
      const { name, memberIds } = req.body ?? {};
      const ids = parseMemberIdsField(memberIds);

      const result = await createGroup(req.auth.userId, {
        name: String(name ?? ''),
        memberIds: ids,
        photo: req.file
          ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
          : null,
      });
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/groups/:id',
  upload.single('photo'),
  async (req, res, next) => {
    try {
      if (!req.auth) throw ApiError.unauthorized();
      const id = req.params.id;
      if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
      const isLeader =
        req.auth.role === 'LEADER' || req.auth.role === 'ADMIN';
      const { name, removePhoto, managerId } = req.body ?? {};
      const result = await updateGroup(id, req.auth.userId, isLeader, {
        name: name !== undefined ? String(name) : undefined,
        removePhoto:
          removePhoto !== undefined ? String(removePhoto) === 'true' : undefined,
        managerId: managerId !== undefined ? String(managerId) : undefined,
        photo: req.file
          ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
          : null,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  },
);

router.delete('/groups/:id', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const isLeader =
      req.auth.role === 'LEADER' || req.auth.role === 'ADMIN';
    const result = await deleteGroup(id, req.auth.userId, isLeader);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/groups/:id/members', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    const isLeader =
      req.auth.role === 'LEADER' || req.auth.role === 'ADMIN';

    const memberIds = parseMemberIdsField(req.body?.memberIds);

    const result = await addGroupMembers(id, req.auth.userId, isLeader, memberIds);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.delete('/groups/:id/members/:userId', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    const targetUserId = req.params.userId;
    if (typeof id !== 'string' || typeof targetUserId !== 'string') {
      throw ApiError.badRequest('Invalid parameters.');
    }
    const isLeader =
      req.auth.role === 'LEADER' || req.auth.role === 'ADMIN';
    const result = await removeGroupMember(
      id,
      req.auth.userId,
      isLeader,
      targetUserId,
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;