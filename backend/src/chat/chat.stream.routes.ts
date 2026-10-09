import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import {
  registerStream,
  unregisterStream,
  setOpenConversationsForUser,
  sendKeepAlive,
  isOnline,
  onlineUserIds,
  sendToUsers,
} from '../realtime/sseHub';

const router = Router();

type AccessPayload = {
  sub: string;
  role: string;
  sid: string;
};

let keepAliveStarted = false;
function ensureKeepAliveLoop(): void {
  if (keepAliveStarted) return;
  keepAliveStarted = true;
  setInterval(() => sendKeepAlive(), 25_000);
}

function readAuthHeader(req: Request): string | null {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

async function validateToken(token: string): Promise<AccessPayload | null> {
  let payload: AccessPayload;
  try {
    payload = jwt.verify(token, env.jwtAccessSecret) as AccessPayload;
  } catch {
    return null;
  }
  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.revokedAt || session.userId !== payload.sub) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.deletedAt || user.status !== 'APPROVED') return null;
  return payload;
}

/**
 * GET /api/v1/chats/stream?token=<jwt>
 */
router.get('/stream', async (req: Request, res: Response) => {
  const token = String(req.query.token ?? '');
  if (!token) {
    res.status(401).json({ status: 401, code: 'UNAUTHORIZED', message: 'Token required.' });
    return;
  }
  const payload = await validateToken(token);
  if (!payload) {
    res.status(401).json({ status: 401, code: 'INVALID_TOKEN', message: 'Invalid or expired token.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(`event: hello\n`);
  res.write(`data: ${JSON.stringify({ userId: payload.sub })}\n\n`);

  const stream = {
    res,
    openConversationIds: new Set<string>(),
    connectedAt: Date.now(),
  };

  registerStream(payload.sub, stream);
  ensureKeepAliveLoop();

  // Presence broadcast: on stream start, tell others.
  broadcastPresence(payload.sub, true).catch(() => {});

  const cleanup = () => {
    unregisterStream(payload.sub, stream);
    broadcastPresence(payload.sub, false).catch(() => {});
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
});

/**
 * POST /api/v1/chats/stream/open-conversations
 * Body: { conversationIds: string[] }
 */
router.post('/stream/open-conversations', async (req: Request, res: Response) => {
  const token = readAuthHeader(req);
  if (!token) {
    res.status(401).json({ status: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    return;
  }
  const payload = await validateToken(token);
  if (!payload) {
    res.status(401).json({ status: 401, code: 'INVALID_TOKEN', message: 'Invalid or expired token.' });
    return;
  }
  const ids = Array.isArray(req.body?.conversationIds)
    ? (req.body.conversationIds as unknown[]).map((v) => String(v))
    : [];
  setOpenConversationsForUser(payload.sub, ids);
  res.json({ ok: true, count: ids.length });
});

/**
 * GET /api/v1/chats/stream/presence?ids=id1,id2,id3
 */
router.get('/stream/presence', async (req: Request, res: Response) => {
  const token = readAuthHeader(req);
  if (!token) {
    res.status(401).json({ status: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' });
    return;
  }
  const payload = await validateToken(token);
  if (!payload) {
    res.status(401).json({ status: 401, code: 'INVALID_TOKEN', message: 'Invalid or expired token.' });
    return;
  }

  const idsParam = String(req.query.ids ?? '');
  const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (ids.length === 0) {
    res.json({ items: [] });
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

async function broadcastPresence(userId: string, online: boolean): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: { status: 'APPROVED', deletedAt: null },
    select: { id: true },
  });
  sendToUsers(
    recipients.map((r) => r.id),
    'presence:changed',
    { userId, online, at: new Date().toISOString() },
  );
}

export default router;