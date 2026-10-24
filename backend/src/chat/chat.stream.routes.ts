import { Router, Request, Response } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../auth/jwt';
import { prisma } from '../db/prisma';
import {
  registerStream,
  unregisterStream,
  setOpenConversationsForUser,
  ensureKeepAliveLoop,
  broadcastPresence,
  isOnline,
  onlineUserIds,
  Stream,
} from '../realtime/sseHub';

/**
 * IMPORTANT: mount this router BEFORE chat.routes in app.ts, otherwise
 * GET /chats/stream is swallowed by the authenticated "/:id" route.
 */
const router = Router();

function readBearer(req: Request): string | null {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

async function validateToken(token: string): Promise<AccessTokenPayload | null> {
  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }
  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: {
      revokedAt: true,
      userId: true,
      user: { select: { status: true, deletedAt: true } },
    },
  });
  if (!session || session.revokedAt || session.userId !== payload.sub) return null;
  if (session.user.deletedAt || session.user.status !== 'APPROVED') return null;
  return payload;
}

function reject(res: Response, code: string, message: string): void {
  res.status(401).json({ status: 401, code, message });
}

/**
 * GET /api/v1/chats/stream
 * Auth: `Authorization: Bearer <jwt>` (preferred) or `?token=<jwt>`.
 */
router.get('/stream', async (req: Request, res: Response) => {
  const token = readBearer(req) ?? String(req.query.token ?? '');
  if (!token) return reject(res, 'UNAUTHORIZED', 'Token required.');

  const payload = await validateToken(token);
  if (!payload) return reject(res, 'INVALID_TOKEN', 'Invalid or expired token.');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);

  res.write('retry: 3000\n\n');
  res.write(`event: hello\ndata: ${JSON.stringify({ userId: payload.sub })}\n\n`);

  const stream: Stream = {
    res,
    openConversationIds: new Set<string>(),
    connectedAt: Date.now(),
  };

  const cameOnline = registerStream(payload.sub, stream);
  ensureKeepAliveLoop();
  if (cameOnline) broadcastPresence(payload.sub, true);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    const wentOffline = unregisterStream(payload.sub, stream);
    if (wentOffline) broadcastPresence(payload.sub, false);
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('close', cleanup);
});

/**
 * POST /api/v1/chats/stream/open-conversations
 * Body: { conversationIds: string[] }
 */
router.post('/stream/open-conversations', async (req: Request, res: Response) => {
  const token = readBearer(req);
  if (!token) return reject(res, 'UNAUTHORIZED', 'Authentication required.');
  const payload = await validateToken(token);
  if (!payload) return reject(res, 'INVALID_TOKEN', 'Invalid or expired token.');

  const ids = Array.isArray(req.body?.conversationIds)
    ? (req.body.conversationIds as unknown[]).map((v) => String(v))
    : [];
  setOpenConversationsForUser(payload.sub, ids);
  res.json({ ok: true, count: Math.min(ids.length, 20) });
});

/**
 * GET /api/v1/chats/stream/presence?ids=id1,id2
 */
router.get('/stream/presence', async (req: Request, res: Response) => {
  const token = readBearer(req);
  if (!token) return reject(res, 'UNAUTHORIZED', 'Authentication required.');
  const payload = await validateToken(token);
  if (!payload) return reject(res, 'INVALID_TOKEN', 'Invalid or expired token.');

  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (ids.length === 0) {
    res.json({ items: [], onlineCount: onlineUserIds().length });
    return;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, lastActiveAt: true },
  });
  res.json({
    items: users.map((u) => ({
      userId: u.id,
      online: isOnline(u.id),
      lastActiveAt: u.lastActiveAt,
    })),
    onlineCount: onlineUserIds().length,
  });
});

export default router;