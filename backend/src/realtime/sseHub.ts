import { Response } from 'express';
import { prisma } from '../db/prisma';

/**
 * In-memory registry of connected SSE streams.
 *
 * On a single-process backend this is safe. When we deploy to more than
 * one instance, we will swap this for a Redis pub/sub layer. For Phase 1
 * and the free-tier single-instance host, this is enough.
 */

type Stream = {
  res: Response;
  /** Conversations the client has explicitly opened. Used for push suppression. */
  openConversationIds: Set<string>;
  /** Timestamp the stream was opened. */
  connectedAt: number;
};

const streamsByUser = new Map<string, Set<Stream>>();

// ------------------------------------------------------------------
// Registration
// ------------------------------------------------------------------

export function registerStream(userId: string, stream: Stream): void {
  let set = streamsByUser.get(userId);
  if (!set) {
    set = new Set();
    streamsByUser.set(userId, set);
  }
  set.add(stream);
}

export function unregisterStream(userId: string, stream: Stream): void {
  const set = streamsByUser.get(userId);
  if (!set) return;
  set.delete(stream);
  if (set.size === 0) streamsByUser.delete(userId);
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

// ------------------------------------------------------------------
// Open-conversation tracking (used for push suppression)
// ------------------------------------------------------------------

/**
 * Update the set of conversation ids this user currently has open.
 * Applied to every stream the user has connected — a user may have more
 * than one stream (e.g. phone + a debug client).
 */
export function setOpenConversationsForUser(
  userId: string,
  conversationIds: string[],
): void {
  const set = streamsByUser.get(userId);
  if (!set) return;
  for (const s of set) {
    s.openConversationIds = new Set(conversationIds);
  }
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
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    // The connection may have already closed. Ignore — cleanup happens
    // in the request close handler.
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
 * Reads the member list fresh from the DB so we do not miss
 * anything if membership changed since the last broadcast.
 */
export async function broadcastToConversation(
  conversationId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId, leftAt: null },
    select: { userId: true },
  });
  const ids = members.map((m) => m.userId);
  sendToUsers(ids, event, data);
}

// ------------------------------------------------------------------
// Keep-alive
// ------------------------------------------------------------------

/**
 * Write a comment line to every open stream so that proxies do not
 * close idle connections. Called every 25 seconds by the loop in the
 * stream route.
 */
export function sendKeepAlive(): void {
  for (const [, set] of streamsByUser) {
    for (const s of set) {
      try {
        s.res.write(`:keepalive\n\n`);
      } catch {
        // Ignore.
      }
    }
  }
}