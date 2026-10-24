import { Response } from 'express';
import { prisma } from '../db/prisma';

/**
 * In-memory registry of connected SSE streams.
 *
 * Safe on a single-process backend (Phase 1 / free-tier host). When we move
 * to more than one instance, swap the internals for Redis pub/sub; the
 * exported function signatures can stay the same.
 */

export type Stream = {
  res: Response;
  /** Conversations the client currently has open (used for push suppression). */
  openConversationIds: Set<string>;
  connectedAt: number;
};

const streamsByUser = new Map<string, Set<Stream>>();

// ------------------------------------------------------------------
// Registration
// ------------------------------------------------------------------

/** Returns true when this registration took the user from offline to online. */
export function registerStream(userId: string, stream: Stream): boolean {
  let set = streamsByUser.get(userId);
  const wasOffline = !set || set.size === 0;
  if (!set) {
    set = new Set();
    streamsByUser.set(userId, set);
  }
  set.add(stream);
  return wasOffline;
}

/** Returns true when this removal took the user from online to offline. */
export function unregisterStream(userId: string, stream: Stream): boolean {
  const set = streamsByUser.get(userId);
  if (!set) return false;
  set.delete(stream);
  if (set.size === 0) {
    streamsByUser.delete(userId);
    return true;
  }
  return false;
}

/**
 * Force-close every stream of a user (session revoked, account deleted,
 * logged in on another device). Broadcasts "offline" afterwards.
 */
export function closeStreamsForUser(userId: string): void {
  const set = streamsByUser.get(userId);
  if (!set) return;
  streamsByUser.delete(userId);
  for (const s of set) {
    try {
      s.res.end();
    } catch {
      // ignore
    }
  }
  broadcastPresence(userId, false);
}

// ------------------------------------------------------------------
// Presence
// ------------------------------------------------------------------

export function isOnline(userId: string): boolean {
  const set = streamsByUser.get(userId);
  return !!set && set.size > 0;
}

export function onlineUserIds(): string[] {
  return Array.from(streamsByUser.keys());
}

/**
 * Tell every *connected* client that a user went online/offline.
 * Offline clients do not need it, so no database query is required.
 */
export function broadcastPresence(userId: string, online: boolean): void {
  sendToUsers(onlineUserIds(), 'presence:changed', {
    userId,
    online,
    at: new Date().toISOString(),
  });
}

// ------------------------------------------------------------------
// Open-conversation tracking (push suppression)
// ------------------------------------------------------------------

export function setOpenConversationsForUser(
  userId: string,
  conversationIds: string[],
): void {
  const set = streamsByUser.get(userId);
  if (!set) return;
  const next = new Set(conversationIds.slice(0, 20));
  for (const s of set) s.openConversationIds = next;
}

export function isUserViewingConversation(
  userId: string,
  conversationId: string,
): boolean {
  const set = streamsByUser.get(userId);
  if (!set) return false;
  for (const s of set) {
    if (s.openConversationIds.has(conversationId)) return true;
  }
  return false;
}

// ------------------------------------------------------------------
// Sending
// ------------------------------------------------------------------

function writeEvent(res: Response, event: string, data: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Connection already gone; cleanup happens in the close handler.
  }
}

export function sendToUser(userId: string, event: string, data: unknown): void {
  const set = streamsByUser.get(userId);
  if (!set) return;
  for (const s of set) writeEvent(s.res, event, data);
}

export function sendToUsers(
  userIds: string[],
  event: string,
  data: unknown,
): void {
  const seen = new Set<string>();
  for (const id of userIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    sendToUser(id, event, data);
  }
}

/**
 * Broadcast to every current member of a conversation.
 * Reads the member list fresh from the DB so membership changes are honoured.
 */
export async function broadcastToConversation(
  conversationId: string,
  event: string,
  data: unknown,
  exceptUserId?: string,
): Promise<void> {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId, leftAt: null },
    select: { userId: true },
  });
  const ids = members
    .map((m) => m.userId)
    .filter((id) => id !== exceptUserId);
  sendToUsers(ids, event, data);
}

// ------------------------------------------------------------------
// Keep-alive
// ------------------------------------------------------------------

export function sendKeepAlive(): void {
  for (const [, set] of streamsByUser) {
    for (const s of set) {
      if (s.res.writableEnded || s.res.destroyed) continue;
      try {
        s.res.write(`:keepalive\n\n`);
      } catch {
        // ignore
      }
    }
  }
}

let keepAliveTimer: NodeJS.Timeout | null = null;
export function ensureKeepAliveLoop(): void {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(sendKeepAlive, 25_000);
  keepAliveTimer.unref?.();
}