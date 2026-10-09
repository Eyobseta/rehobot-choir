import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, touchLastActive } from '../auth/middleware';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { sendToUsers, broadcastToConversation } from '../realtime/sseHub';

const router = Router();

router.use(authenticate, touchLastActive);

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function requireMembership(conversationId: string, userId: string) {
  const m = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!m || m.leftAt) {
    throw ApiError.forbidden('You are not a member of this conversation.');
  }
  return m;
}

// Per-user-per-conversation typing throttle.
// Key = `${userId}:${conversationId}`, value = last sent timestamp (ms).
const lastTypingAt = new Map<string, number>();
const TYPING_THROTTLE_MS = 2000;

// ------------------------------------------------------------------
// Read state
// ------------------------------------------------------------------

/**
 * POST /api/v1/chats/:id/read
 * Marks the conversation as read up to now for the caller and broadcasts
 * a read:updated event to the other members.
 */
router.post('/:id/read', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    await requireMembership(id, req.auth.userId);

    const now = new Date();
    await prisma.chatReadState.upsert({
      where: {
        conversationId_userId: { conversationId: id, userId: req.auth.userId },
      },
      create: {
        conversationId: id,
        userId: req.auth.userId,
        lastReadAt: now,
      },
      update: { lastReadAt: now },
    });

    // Broadcast to the other members so their UI can update.
    await broadcastToConversation(id, 'read:updated', {
      conversationId: id,
      userId: req.auth.userId,
      lastReadAt: now.toISOString(),
    });

    res.json({ ok: true, lastReadAt: now.toISOString() });
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------------
// Typing
// ------------------------------------------------------------------

/**
 * POST /api/v1/chats/:id/typing
 * Best-effort. Throttled server-side to once every 2 seconds per user
 * per conversation.
 */
router.post('/:id/typing', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const id = req.params.id;
    if (typeof id !== 'string') throw ApiError.badRequest('Invalid id.');
    await requireMembership(id, req.auth.userId);

    const key = `${req.auth.userId}:${id}`;
    const now = Date.now();
    const last = lastTypingAt.get(key) ?? 0;
    if (now - last < TYPING_THROTTLE_MS) {
      res.json({ ok: true, throttled: true });
      return;
    }
    lastTypingAt.set(key, now);

    await broadcastToConversation(id, 'typing', {
      conversationId: id,
      userId: req.auth.userId,
      at: new Date().toISOString(),
    });

    res.json({ ok: true, throttled: false });
  } catch (e) {
    next(e);
  }
});

export default router;