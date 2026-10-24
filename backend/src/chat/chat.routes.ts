import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../auth/middleware';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { broadcastToConversation } from '../realtime/sseHub';
import {
  listConversations,
  getConversationDetail,
  getUnreadTotal,
  openDirectConversation,
  listMessages,
  searchMessages,
  listChanges,
  sendMessage,
  editMessage,
  deleteMessage,
  markRead,
  toggleReaction,
  pinMessage,
  unpinMessage,
  reportMessage,
  listReports,
  resolveReport,
  createGroup,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  deleteGroup,
} from './chat.service';

/**
 * All routes require authentication. Mount order in app.ts:
 *
 *   api.use('/chats', chatStreamRoutes);   // FIRST (SSE has its own auth)
 *   api.use('/chats', chatRoutes);         // this file, ONCE
 */
const router = Router();

// ------------------------------------------------------------------
// Upload handling
// ------------------------------------------------------------------

const MAX_FILE_BYTES = 10 * 1024 * 1024; // Cloudinary free plan caps images at 10 MB

const PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function isVoiceMime(m: string): boolean {
  return m.startsWith('audio/') || m === 'video/mp4' || m === 'video/3gpp';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 11 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (file.fieldname === 'voice') {
      if (!isVoiceMime(mime)) return cb(ApiError.badRequest('Unsupported audio format.'));
      return cb(null, true);
    }
    // 'photos' and 'photo'
    if (!PHOTO_TYPES.has(mime)) {
      return cb(ApiError.badRequest('Only JPEG, PNG, WebP or HEIC photos are allowed.'));
    }
    cb(null, true);
  },
});

/** Turn multer errors into our standard error shape instead of a 500. */
function withUpload(mw: RequestHandler): RequestHandler {
  return (req, res, next) => {
    mw(req, res, (err?: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new ApiError(413, 'FILE_TOO_LARGE', 'A file is too large (max 10 MB each). Try the compressed option.'),
          );
        }
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(ApiError.badRequest('Too many files or an unexpected file field.'));
        }
        return next(ApiError.badRequest(err.message));
      }
      next(err);
    });
  };
}

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------

type Handler = (req: Request, res: Response) => Promise<unknown>;

function wrap(fn: Handler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

function authOf(req: Request) {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth;
}

function param(req: Request, name: string): string {
  const v = (req.params as Record<string, unknown>)[name];
  if (typeof v !== 'string' || !v) throw ApiError.badRequest('Invalid id.');
  return v;
}

function leaderRole(role: string): boolean {
  return role === 'LEADER' || role === 'ADMIN';
}

/** lastActiveAt update, at most once a minute per user (typing/read spam safe). */
const lastTouch = new Map<string, number>();
function touchLastActiveThrottled(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth) {
    const now = Date.now();
    const last = lastTouch.get(req.auth.userId) ?? 0;
    if (now - last > 60_000) {
      lastTouch.set(req.auth.userId, now);
      prisma.user
        .update({ where: { id: req.auth.userId }, data: { lastActiveAt: new Date() } })
        .catch(() => undefined);
    }
  }
  next();
}

router.use(authenticate, touchLastActiveThrottled);

/** Accepts a real array (JSON body) or a JSON-encoded array string (multipart). */
function parseMemberIdsField(raw: unknown): string[] {
  const bad = () => ApiError.badRequest('memberIds must be a JSON array, e.g. ["id1","id2"].');
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v));
  if (typeof raw === 'string') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw bad();
    }
    if (!Array.isArray(parsed)) throw bad();
    return parsed.map((v) => String(v));
  }
  throw bad();
}

// ------------------------------------------------------------------
// Static paths first (they must come before "/:id")
// ------------------------------------------------------------------

router.get('/', wrap(async (req, res) => {
  const items = await listConversations(authOf(req).userId);
  res.json({ items });
}));

router.get('/unread-count', wrap(async (req, res) => {
  res.json(await getUnreadTotal(authOf(req).userId));
}));

// Leader moderation queue (SRS 19.23)
router.get('/reports', authorize('LEADER', 'ADMIN'), wrap(async (_req, res) => {
  res.json(await listReports());
}));

router.post('/reports/:messageId/resolve', authorize('LEADER', 'ADMIN'), wrap(async (req, res) => {
  const resolution = String(req.body?.resolution ?? '').toUpperCase();
  res.json(await resolveReport(param(req, 'messageId'), resolution as 'KEPT' | 'DELETED' | 'DISMISSED'));
}));

router.post('/direct', wrap(async (req, res) => {
  const otherUserId = String(req.body?.userId ?? '');
  if (!otherUserId) throw ApiError.badRequest('userId is required.');
  res.json(await openDirectConversation(authOf(req).userId, otherUserId));
}));

// ------------------------------------------------------------------
// Groups
// ------------------------------------------------------------------

router.post('/groups', withUpload(upload.single('photo')), wrap(async (req, res) => {
  const auth = authOf(req);
  if (!leaderRole(auth.role)) throw ApiError.forbidden('Only leaders can create groups.');
  const { name, memberIds } = req.body ?? {};
  const result = await createGroup(auth.userId, {
    name: String(name ?? ''),
    memberIds: parseMemberIdsField(memberIds),
    photo: req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : null,
  });
  res.status(201).json(result);
}));

router.patch('/groups/:id', withUpload(upload.single('photo')), wrap(async (req, res) => {
  const auth = authOf(req);
  const { name, removePhoto, managerId } = req.body ?? {};
  const result = await updateGroup(param(req, 'id'), auth.userId, leaderRole(auth.role), {
    name: name !== undefined ? String(name) : undefined,
    removePhoto: removePhoto !== undefined ? String(removePhoto) === 'true' : undefined,
    managerId: managerId !== undefined && managerId !== '' ? String(managerId) : undefined,
    photo: req.file ? { buffer: req.file.buffer, mimetype: req.file.mimetype } : null,
  });
  res.json(result);
}));

router.delete('/groups/:id', wrap(async (req, res) => {
  const auth = authOf(req);
  res.json(await deleteGroup(param(req, 'id'), auth.userId, leaderRole(auth.role)));
}));

router.post('/groups/:id/members', wrap(async (req, res) => {
  const auth = authOf(req);
  const memberIds = parseMemberIdsField(req.body?.memberIds);
  res.json(await addGroupMembers(param(req, 'id'), auth.userId, leaderRole(auth.role), memberIds));
}));

router.delete('/groups/:id/members/:userId', wrap(async (req, res) => {
  const auth = authOf(req);
  res.json(
    await removeGroupMember(
      param(req, 'id'),
      auth.userId,
      leaderRole(auth.role),
      param(req, 'userId'),
    ),
  );
}));

// ------------------------------------------------------------------
// Single-message actions
// ------------------------------------------------------------------

router.patch('/messages/:id', wrap(async (req, res) => {
  const text = String(req.body?.text ?? '');
  res.json(await editMessage(param(req, 'id'), authOf(req).userId, text));
}));

router.delete('/messages/:id', wrap(async (req, res) => {
  const auth = authOf(req);
  res.json(await deleteMessage(param(req, 'id'), auth.userId, leaderRole(auth.role)));
}));

/** Toggle: sends the same emoji again to remove it. */
router.post('/messages/:id/reactions', wrap(async (req, res) => {
  res.json(await toggleReaction(param(req, 'id'), authOf(req).userId, String(req.body?.emoji ?? '')));
}));

router.post('/messages/:id/pin', wrap(async (req, res) => {
  res.json(await pinMessage(param(req, 'id'), authOf(req).userId));
}));

router.delete('/messages/:id/pin', wrap(async (req, res) => {
  res.json(await unpinMessage(param(req, 'id'), authOf(req).userId));
}));

router.post('/messages/:id/report', wrap(async (req, res) => {
  res.json(await reportMessage(param(req, 'id'), authOf(req).userId));
}));

// ------------------------------------------------------------------
// Per-conversation
// ------------------------------------------------------------------

router.get('/:id', wrap(async (req, res) => {
  const conversation = await getConversationDetail(param(req, 'id'), authOf(req).userId);
  res.json({ conversation });
}));

router.get('/:id/messages', wrap(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  res.json(
    await listMessages(param(req, 'id'), authOf(req).userId, {
      before: req.query.before ? String(req.query.before) : undefined,
      after: req.query.after ? String(req.query.after) : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    }),
  );
}));

router.get('/:id/changes', wrap(async (req, res) => {
  res.json(await listChanges(param(req, 'id'), authOf(req).userId, String(req.query.since ?? '')));
}));

router.get('/:id/search', wrap(async (req, res) => {
  res.json(
    await searchMessages(
      param(req, 'id'),
      authOf(req).userId,
      String(req.query.q ?? ''),
      req.query.before ? String(req.query.before) : undefined,
    ),
  );
}));

router.post(
  '/:id/messages',
  withUpload(
    upload.fields([
      { name: 'photos', maxCount: 10 },
      { name: 'voice', maxCount: 1 },
    ]),
  ),
  wrap(async (req, res) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const photos = files?.photos ?? [];
    const voiceFile = files?.voice?.[0];

    const body = req.body ?? {};
    const result = await sendMessage(param(req, 'id'), authOf(req).userId, {
      text: body.text !== undefined ? String(body.text) : undefined,
      replyToId: body.replyToId ? String(body.replyToId) : null,
      clientId: body.clientId ? String(body.clientId) : null,
      photos: photos.map((f) => ({ buffer: f.buffer, mimetype: f.mimetype })),
      voice: voiceFile
        ? {
            buffer: voiceFile.buffer,
            mimetype: voiceFile.mimetype,
            durationSeconds: Number(body.voiceDurationSeconds ?? 0),
          }
        : null,
    });
    res.status(result.duplicate ? 200 : 201).json({ message: result.message });
  }),
);

router.post('/:id/read', wrap(async (req, res) => {
  res.json(await markRead(param(req, 'id'), authOf(req).userId));
}));

// Typing: best-effort, throttled to once per 2 s per user per conversation.
const lastTypingAt = new Map<string, number>();
const TYPING_THROTTLE_MS = 2000;
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [k, t] of lastTypingAt) if (t < cutoff) lastTypingAt.delete(k);
}, 60_000).unref?.();

router.post('/:id/typing', wrap(async (req, res) => {
  const auth = authOf(req);
  const id = param(req, 'id');

  const key = `${auth.userId}:${id}`;
  const now = Date.now();
  if (now - (lastTypingAt.get(key) ?? 0) < TYPING_THROTTLE_MS) {
    res.json({ ok: true, throttled: true });
    return;
  }

  // Membership check (cheap, single indexed row).
  const m = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: auth.userId } },
    select: { leftAt: true },
  });
  if (!m || m.leftAt) throw ApiError.forbidden('You are not a member of this conversation.');

  lastTypingAt.set(key, now);
  await broadcastToConversation(
    id,
    'typing',
    { conversationId: id, userId: auth.userId, at: new Date().toISOString() },
    auth.userId,
  );
  res.json({ ok: true, throttled: false });
}));

export default router;