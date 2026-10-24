import {
  Prisma,
  ChatMessageType,
  ChatMediaType,
  ConversationType,
  UserRole,
  MessageReportResolution,
} from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { uploadBuffer, deleteByPublicId } from '../storage/cloudinary';
import {
  sendToUsers,
  broadcastToConversation,
  isOnline,
} from '../realtime/sseHub';
import { notifyChatMessage } from './chat.notify';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const VOICE_MAX_SECONDS = 60;
const CHAT_MEDIA_RETENTION_DAYS = 365; // SRS 19.15
const REPORT_RETENTION_DAYS = 30; // SRS 19.23
const MAX_PINS = 3; // SRS 19.24
const MAX_TEXT_LENGTH = 4000;
const MAX_PHOTOS = 10; // SRS 19.10
const MAX_GROUP_NAME = 60;
const MESSAGE_PAGE_SIZE = 30;
const MAX_MESSAGE_PAGE_SIZE = 60;
const GENERAL_KEY = 'GENERAL';
const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function directKeyFor(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function displayName(u: {
  status: string;
  memberProfile: { fullName: string } | null;
}): string {
  if (u.status === 'DELETED') return 'Deleted Member';
  return u.memberProfile?.fullName ?? 'Member';
}

function logWarn(msg: string, e: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(`[chat] ${msg}`, e);
}

// Simple in-memory send rate limit: 30 messages / 60 s / user.
const sendLog = new Map<string, number[]>();
function checkSendRate(userId: string): void {
  const now = Date.now();
  const recent = (sendLog.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 30) {
    throw ApiError.tooMany('You are sending messages too quickly. Please wait a moment.');
  }
  recent.push(now);
  sendLog.set(userId, recent);
  if (sendLog.size > 2000) {
    for (const [k, v] of sendLog) {
      if (v.every((t) => now - t >= 60_000)) sendLog.delete(k);
    }
  }
}

// ------------------------------------------------------------------
// Access checks
// ------------------------------------------------------------------

async function requireMembership(conversationId: string, userId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!member || member.leftAt) {
    throw ApiError.forbidden('You are not a member of this conversation.');
  }
  return member;
}

async function requireApproved(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, deletedAt: true, role: true },
  });
  if (!user || user.deletedAt || user.status !== 'APPROVED') {
    throw ApiError.forbidden('Only approved members can use chat.');
  }
  return user;
}

// ------------------------------------------------------------------
// General chat (singleton, race-safe via directKey = 'GENERAL')
// ------------------------------------------------------------------

async function getGeneralConversationId(): Promise<string> {
  let c = await prisma.chatConversation.findFirst({
    where: { OR: [{ directKey: GENERAL_KEY }, { type: ConversationType.GENERAL }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true, directKey: true },
  });

  if (!c) {
    try {
      c = await prisma.chatConversation.create({
        data: { type: ConversationType.GENERAL, directKey: GENERAL_KEY },
        select: { id: true, directKey: true },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      c = await prisma.chatConversation.findUnique({
        where: { directKey: GENERAL_KEY },
        select: { id: true, directKey: true },
      });
    }
  } else if (c.directKey !== GENERAL_KEY) {
    // Legacy row created before the unique key existed.
    try {
      await prisma.chatConversation.update({
        where: { id: c.id },
        data: { directKey: GENERAL_KEY },
      });
    } catch {
      // ignore
    }
  }

  if (!c) throw ApiError.internal('Could not load General chat.');
  return c.id;
}

let lastGeneralSync = 0;

/**
 * Make sure every approved member/leader is a member of General chat.
 * Throttled to once a minute; cheap because it only inserts missing rows.
 */
async function syncGeneralMembers(generalId: string, force = false): Promise<void> {
  if (!force && Date.now() - lastGeneralSync < 60_000) return;
  lastGeneralSync = Date.now();

  const missing = await prisma.user.findMany({
    where: {
      status: 'APPROVED',
      deletedAt: null,
      role: { in: [UserRole.MEMBER, UserRole.LEADER] },
      chatMemberships: { none: { conversationId: generalId } },
    },
    select: { id: true },
  });
  if (missing.length === 0) return;

  await prisma.conversationMember.createMany({
    data: missing.map((u) => ({ conversationId: generalId, userId: u.id })),
    skipDuplicates: true,
  });
}

/**
 * Call this from the registration-approval flow so a newly approved member
 * is in General chat immediately (otherwise they are added on first chat open
 * or by the 60-second sync).
 */
export async function addToGeneralChat(userId: string): Promise<void> {
  const generalId = await getGeneralConversationId();
  await prisma.conversationMember.createMany({
    data: [{ conversationId: generalId, userId }],
    skipDuplicates: true,
  });
}

// ------------------------------------------------------------------
// Message shaping (one shape everywhere: REST + SSE)
// ------------------------------------------------------------------

const messageInclude = Prisma.validator<Prisma.ChatMessageInclude>()({
  sender: {
    select: {
      id: true,
      status: true,
      memberProfile: { select: { fullName: true, profilePhotoUrl: true } },
    },
  },
  media: {
    select: { id: true, type: true, storageUrl: true, durationSeconds: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  replyTo: {
    select: {
      id: true,
      text: true,
      deletedAt: true,
      type: true,
      sender: {
        select: {
          id: true,
          status: true,
          memberProfile: { select: { fullName: true } },
        },
      },
    },
  },
  reactions: { select: { emoji: true, userId: true } },
  pins: { select: { id: true } },
});

type MessageRow = Prisma.ChatMessageGetPayload<{ include: typeof messageInclude }>;

export function shapeMessage(m: MessageRow) {
  const deleted = Boolean(m.deletedAt);
  return {
    id: m.id,
    conversationId: m.conversationId,
    clientId: m.clientId,
    type: m.type,
    text: deleted ? null : m.text,
    deleted,
    createdAt: m.createdAt,
    editedAt: deleted ? null : m.editedAt,
    sender: {
      id: m.sender.id,
      fullName: displayName(m.sender),
      profilePhotoUrl: m.sender.memberProfile?.profilePhotoUrl ?? null,
    },
    media: deleted ? [] : m.media,
    // Photos/voice older than the 1-year retention window are purged.
    mediaExpired: !deleted && m.type !== 'TEXT' && m.media.length === 0,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          type: m.replyTo.type,
          text: m.replyTo.deletedAt ? null : m.replyTo.text,
          deleted: Boolean(m.replyTo.deletedAt),
          sender: {
            id: m.replyTo.sender.id,
            fullName: displayName(m.replyTo.sender),
          },
        }
      : null,
    reactions: deleted ? [] : m.reactions,
    pinned: !deleted && m.pins.length > 0,
  };
}

export type ShapedMessage = ReturnType<typeof shapeMessage>;

async function loadShapedMessage(id: string): Promise<ShapedMessage> {
  const row = await prisma.chatMessage.findUnique({
    where: { id },
    include: messageInclude,
  });
  if (!row) throw ApiError.notFound('Message not found.');
  return shapeMessage(row);
}

// ------------------------------------------------------------------
// Unread counts
// ------------------------------------------------------------------

async function unreadByConversation(userId: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ conversationId: string; count: number }[]>(
    Prisma.sql`
      SELECT m."conversationId" AS "conversationId", COUNT(*)::int AS "count"
      FROM chat_messages m
      JOIN conversation_members cm
        ON cm."conversationId" = m."conversationId"
       AND cm."userId" = ${userId}
       AND cm."leftAt" IS NULL
      LEFT JOIN chat_read_states rs
        ON rs."conversationId" = m."conversationId"
       AND rs."userId" = ${userId}
      WHERE m."senderId" <> ${userId}
        AND m."deletedAt" IS NULL
        AND m."createdAt" > COALESCE(rs."lastReadAt", cm."joinedAt")
      GROUP BY m."conversationId"
    `,
  );
  return new Map(rows.map((r) => [r.conversationId, Number(r.count)]));
}

export async function getUnreadTotal(userId: string) {
  const map = await unreadByConversation(userId);
  let total = 0;
  for (const n of map.values()) total += n;
  return { total, byConversation: Object.fromEntries(map) };
}

// ------------------------------------------------------------------
// Conversations
// ------------------------------------------------------------------

export async function listConversations(userId: string) {
  await requireApproved(userId);

  const generalId = await getGeneralConversationId();
  await prisma.conversationMember.createMany({
    data: [{ conversationId: generalId, userId }],
    skipDuplicates: true,
  });
  syncGeneralMembers(generalId).catch((e) => logWarn('general sync failed', e));

  const conversations = await prisma.chatConversation.findMany({
    where: { members: { some: { userId, leftAt: null } } },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          managerId: true,
          createdByUserId: true,
        },
      },
      _count: { select: { members: { where: { leftAt: null } } } },
      messages: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          id: true,
          type: true,
          text: true,
          createdAt: true,
          deletedAt: true,
          senderId: true,
          sender: {
            select: { status: true, memberProfile: { select: { fullName: true } } },
          },
        },
      },
    },
  });

  // Other participant of each DM (kept out of the main query so General /
  // groups with many members do not load every member row).
  const dmIds = conversations
    .filter((c) => c.type === ConversationType.DIRECT)
    .map((c) => c.id);
  const dmOthers = dmIds.length
    ? await prisma.conversationMember.findMany({
        where: { conversationId: { in: dmIds }, userId: { not: userId } },
        select: {
          conversationId: true,
          leftAt: true,
          user: {
            select: {
              id: true,
              status: true,
              lastActiveAt: true,
              memberProfile: { select: { fullName: true, profilePhotoUrl: true } },
            },
          },
        },
      })
    : [];
  const otherByConv = new Map(dmOthers.map((o) => [o.conversationId, o]));

  const unread = await unreadByConversation(userId);

  const items = conversations
    .map((c) => {
      const last = c.messages[0] ?? null;
      let title = '';
      let photoUrl: string | null = null;
      let readOnly = false;
      let otherUserId: string | null = null;
      let online: boolean | null = null;
      let lastActiveAt: Date | null = null;

      if (c.type === ConversationType.DIRECT) {
        const other = otherByConv.get(c.id);
        if (other) {
          title = displayName(other.user);
          photoUrl = other.user.memberProfile?.profilePhotoUrl ?? null;
          otherUserId = other.user.id;
          online = isOnline(other.user.id);
          lastActiveAt = other.user.lastActiveAt;
          readOnly = Boolean(other.leftAt) || other.user.status !== 'APPROVED';
        } else {
          title = 'Member';
          readOnly = true;
        }
      } else if (c.type === ConversationType.GENERAL) {
        title = 'General Choir Chat';
      } else {
        title = c.group?.name ?? 'Group';
        photoUrl = c.group?.photoUrl ?? null;
      }

      return {
        id: c.id,
        type: c.type,
        title,
        photoUrl,
        readOnly,
        otherUserId,
        online,
        lastActiveAt,
        memberCount: c._count.members,
        unreadCount: unread.get(c.id) ?? 0,
        lastMessageAt: last?.createdAt ?? c.lastMessageAt ?? c.createdAt,
        lastMessage: last
          ? {
              id: last.id,
              type: last.type,
              text: last.deletedAt ? null : last.text,
              deleted: Boolean(last.deletedAt),
              senderId: last.senderId,
              senderName: displayName(last.sender),
              createdAt: last.createdAt,
            }
          : null,
        group: c.group
          ? {
              id: c.group.id,
              name: c.group.name,
              photoUrl: c.group.photoUrl,
              managerId: c.group.managerId,
            }
          : null,
      };
    })
    // Hide DMs that were opened but never used.
    .filter((i) => !(i.type === ConversationType.DIRECT && !i.lastMessage))
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );

  return items;
}

export async function getConversationDetail(conversationId: string, userId: string) {
  await requireMembership(conversationId, userId);

  const c = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      group: true,
      members: {
        where: { leftAt: null },
        select: {
          userId: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              role: true,
              status: true,
              lastActiveAt: true,
              memberProfile: { select: { fullName: true, profilePhotoUrl: true } },
            },
          },
        },
      },
    },
  });
  if (!c) throw ApiError.notFound('Conversation not found.');

  const [readStates, pins] = await Promise.all([
    prisma.chatReadState.findMany({
      where: { conversationId },
      select: { userId: true, lastReadAt: true },
    }),
    prisma.messagePin.findMany({
      where: { conversationId, message: { deletedAt: null } },
      orderBy: { pinnedAt: 'desc' },
      take: MAX_PINS,
      include: { message: { include: messageInclude } },
    }),
  ]);

  let title = '';
  let readOnly = false;
  if (c.type === ConversationType.GENERAL) title = 'General Choir Chat';
  else if (c.type === ConversationType.GROUP) title = c.group?.name ?? 'Group';
  else {
    const other = c.members.find((m) => m.userId !== userId);
    title = other ? displayName(other.user) : 'Member';
    readOnly = !other;
  }

  return {
    id: c.id,
    type: c.type,
    title,
    readOnly,
    group: c.group
      ? {
          id: c.group.id,
          name: c.group.name,
          photoUrl: c.group.photoUrl,
          managerId: c.group.managerId,
          createdByUserId: c.group.createdByUserId,
        }
      : null,
    members: c.members.map((m) => ({
      userId: m.userId,
      role: m.user.role,
      fullName: displayName(m.user),
      profilePhotoUrl: m.user.memberProfile?.profilePhotoUrl ?? null,
      lastActiveAt: m.user.lastActiveAt,
      online: isOnline(m.userId),
    })),
    readStates,
    pinned: pins.map((p) => shapeMessage(p.message)),
  };
}

export async function openDirectConversation(userId: string, otherUserId: string) {
  if (userId === otherUserId) {
    throw ApiError.badRequest('Cannot open a DM with yourself.');
  }
  await Promise.all([requireApproved(userId), requireApproved(otherUserId)]);

  const directKey = directKeyFor(userId, otherUserId);

  const find = () => prisma.chatConversation.findUnique({ where: { directKey } });
  let conv = await find();

  if (!conv) {
    try {
      conv = await prisma.chatConversation.create({
        data: {
          type: ConversationType.DIRECT,
          directKey,
          members: { create: [{ userId }, { userId: otherUserId }] },
        },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      conv = await find();
    }
  }
  if (!conv) throw ApiError.internal('Could not open conversation.');

  // Re-activate both sides if either had left.
  await prisma.conversationMember.updateMany({
    where: { conversationId: conv.id, userId: { in: [userId, otherUserId] }, leftAt: { not: null } },
    data: { leftAt: null },
  });
  for (const uid of [userId, otherUserId]) {
    await prisma.conversationMember.createMany({
      data: [{ conversationId: conv.id, userId: uid }],
      skipDuplicates: true,
    });
  }
  return { id: conv.id };
}

// ------------------------------------------------------------------
// Messages: list / search
// ------------------------------------------------------------------

/**
 * Newest-first page.
 *  - default / before=<id> : older messages. nextCursor = oldest id returned.
 *  - after=<id>            : messages newer than <id> (gap fill after an SSE
 *                            reconnect). nextCursor = newest id returned.
 */
export async function listMessages(
  conversationId: string,
  userId: string,
  opts: { before?: string; after?: string; limit?: number } = {},
) {
  await requireMembership(conversationId, userId);
  // Taken BEFORE the query so clients can safely use it as their "last synced" mark.
  const serverTime = new Date().toISOString();

  const take = Math.min(Math.max(opts.limit ?? MESSAGE_PAGE_SIZE, 1), MAX_MESSAGE_PAGE_SIZE);
  const where: Prisma.ChatMessageWhereInput = { conversationId };
  let direction: 'desc' | 'asc' = 'desc';

  const anchorId = opts.after ?? opts.before;
  if (anchorId) {
    const anchor = await prisma.chatMessage.findFirst({
      where: { id: anchorId, conversationId },
      select: { id: true, createdAt: true },
    });
    if (!anchor) throw ApiError.badRequest('Invalid cursor.');
    if (opts.after) {
      direction = 'asc';
      where.OR = [
        { createdAt: { gt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { gt: anchor.id } },
      ];
    } else {
      where.OR = [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ];
    }
  }

  const rows = await prisma.chatMessage.findMany({
    where,
    orderBy: [{ createdAt: direction }, { id: direction }],
    take: take + 1,
    include: messageInclude,
  });

  const hasMore = rows.length > take;
  let page = rows.slice(0, take);
  if (direction === 'asc') page = page.reverse(); // always return newest-first
  const items = page.map(shapeMessage);

  let nextCursor: string | null = null;
  if (hasMore) {
    const edge = direction === 'asc' ? items[0] : items[items.length - 1];
    nextCursor = edge?.id ?? null;
  }
  return { items, hasMore, nextCursor, serverTime };
}

/** SRS 19.18 — text messages only. */
export async function searchMessages(
  conversationId: string,
  userId: string,
  query: string,
  before?: string,
) {
  await requireMembership(conversationId, userId);
  const q = query.trim();
  if (q.length < 2) throw ApiError.badRequest('Search text must be at least 2 characters.');

  const where: Prisma.ChatMessageWhereInput = {
    conversationId,
    type: ChatMessageType.TEXT,
    deletedAt: null,
    text: { contains: q, mode: 'insensitive' },
  };
  if (before) {
    const anchor = await prisma.chatMessage.findFirst({
      where: { id: before, conversationId },
      select: { id: true, createdAt: true },
    });
    if (anchor) {
      where.AND = [
        {
          OR: [
            { createdAt: { lt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { lt: anchor.id } },
          ],
        },
      ];
    }
  }

  const take = 30;
  const rows = await prisma.chatMessage.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    include: messageInclude,
  });
  const hasMore = rows.length > take;
  const items = rows.slice(0, take).map(shapeMessage);
  return {
    items,
    hasMore,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

/**
 * On-device cache support: messages (of any age) whose content changed after
 * `since` — edited, deleted, or reacted to. The app merges them over its cache,
 * so it only ever needs to download what actually changed.
 */
export async function listChanges(conversationId: string, userId: string, since: string) {
  await requireMembership(conversationId, userId);
  const serverTime = new Date().toISOString();
  const sinceDate = new Date(since);
  if (Number.isNaN(sinceDate.getTime())) throw ApiError.badRequest('Invalid since.');

  const LIMIT = 200;
  const rows = await prisma.chatMessage.findMany({
    where: {
      conversationId,
      OR: [
        { editedAt: { gt: sinceDate } },
        { deletedAt: { gt: sinceDate } },
        { reactions: { some: { createdAt: { gt: sinceDate } } } },
      ],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: LIMIT + 1,
    include: messageInclude,
  });

  return {
    items: rows.slice(0, LIMIT).map(shapeMessage),
    // Too many changes to apply one by one: the client drops its cache and reloads.
    truncated: rows.length > LIMIT,
    serverTime,
  };
}

// ------------------------------------------------------------------
// Messages: send / edit / delete
// ------------------------------------------------------------------

export type SendMessageInput = {
  text?: string;
  replyToId?: string | null;
  clientId?: string | null;
  photos?: { buffer: Buffer; mimetype: string }[];
  voice?: { buffer: Buffer; mimetype: string; durationSeconds: number } | null;
};

type UploadedMedia = {
  type: ChatMediaType;
  storageUrl: string;
  storagePublicId: string;
  durationSeconds?: number;
  retentionUntil: Date;
};

async function cleanupUploaded(media: UploadedMedia[]): Promise<void> {
  await Promise.all(
    media.map((m) =>
      deleteByPublicId(m.storagePublicId, m.type === 'VOICE' ? 'video' : 'image'),
    ),
  );
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  input: SendMessageInput,
): Promise<{ message: ShapedMessage; duplicate: boolean }> {
  await requireMembership(conversationId, userId);

  const text = (input.text ?? '').trim();
  const photos = input.photos ?? [];
  const voice = input.voice ?? null;
  const clientId = input.clientId ? input.clientId.slice(0, 64) : null;

  if (!text && photos.length === 0 && !voice) {
    throw ApiError.badRequest('Message cannot be empty.');
  }
  if (voice && photos.length > 0) {
    throw ApiError.badRequest('Send photos and voice messages separately.');
  }
  if (text.length > MAX_TEXT_LENGTH) throw ApiError.badRequest('Message is too long.');
  if (photos.length > MAX_PHOTOS) {
    throw ApiError.badRequest(`Up to ${MAX_PHOTOS} photos per message.`);
  }

  let voiceSeconds = 0;
  if (voice) {
    voiceSeconds = Math.round(voice.durationSeconds);
    if (!Number.isFinite(voiceSeconds) || voiceSeconds < 1 || voiceSeconds > VOICE_MAX_SECONDS + 1) {
      throw ApiError.badRequest('Voice messages must be between 1 and 60 seconds.');
    }
    voiceSeconds = Math.min(voiceSeconds, VOICE_MAX_SECONDS);
  }

  // Idempotent retry: same clientId from the same sender returns the original.
  if (clientId) {
    const dup = await prisma.chatMessage.findUnique({
      where: { senderId_clientId: { senderId: userId, clientId } },
      select: { id: true },
    });
    if (dup) return { message: await loadShapedMessage(dup.id), duplicate: true };
  }

  checkSendRate(userId);

  const conv = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    select: { type: true, group: { select: { name: true } } },
  });
  if (!conv) throw ApiError.notFound('Conversation not found.');

  if (conv.type === ConversationType.DIRECT) {
    const other = await prisma.conversationMember.findFirst({
      where: { conversationId, userId: { not: userId }, leftAt: null },
      select: { id: true },
    });
    if (!other) {
      throw ApiError.forbidden(
        'This member is no longer available.',
        'CONVERSATION_READ_ONLY',
      );
    }
  }

  if (input.replyToId) {
    const parent = await prisma.chatMessage.findUnique({
      where: { id: input.replyToId },
      select: { conversationId: true, deletedAt: true },
    });
    if (!parent || parent.conversationId !== conversationId || parent.deletedAt) {
      throw ApiError.badRequest('Cannot reply to that message.');
    }
  }

  let type: ChatMessageType = ChatMessageType.TEXT;
  if (voice) type = ChatMessageType.VOICE;
  else if (photos.length > 0) type = ChatMessageType.PHOTO;

  // ---- Upload media first (external I/O before the DB write) ----
  const retentionUntil = new Date(Date.now() + CHAT_MEDIA_RETENTION_DAYS * DAY_MS);
  const uploaded: UploadedMedia[] = [];

  try {
    if (photos.length > 0) {
      const results = await Promise.allSettled(
        photos.map((p) =>
          uploadBuffer(p.buffer, 'rehobot/chat-photos', 'chat', 'image', {
            keepOriginal: true,
          }),
        ),
      );
      let failed = false;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          uploaded.push({
            type: ChatMediaType.PHOTO,
            storageUrl: r.value.url,
            storagePublicId: r.value.publicId,
            retentionUntil,
          });
        } else {
          failed = true;
          logWarn('photo upload failed', r.reason);
        }
      }
      if (failed) throw new Error('photo upload failed');
    }

    if (voice) {
      const r = await uploadBuffer(voice.buffer, 'rehobot/chat-voice', 'chatv', 'video');
      uploaded.push({
        type: ChatMediaType.VOICE,
        storageUrl: r.url,
        storagePublicId: r.publicId,
        durationSeconds: voiceSeconds,
        retentionUntil,
      });
    }
  } catch (e) {
    await cleanupUploaded(uploaded);
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, 'UPLOAD_FAILED', 'Could not upload your media. Please try again.');
  }

  // ---- Create message + media + bump conversation ----
  let createdId: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          conversationId,
          senderId: userId,
          type,
          text: text || null,
          replyToId: input.replyToId ?? null,
          clientId,
          media: uploaded.length > 0 ? { create: uploaded } : undefined,
        },
        select: { id: true, createdAt: true },
      });
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt },
      });
      // The sender has obviously seen everything up to their own message.
      await tx.chatReadState.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        create: { conversationId, userId, lastReadAt: message.createdAt, lastReadMessageId: message.id },
        update: { lastReadAt: message.createdAt, lastReadMessageId: message.id },
      });
      return message;
    });
    createdId = created.id;
  } catch (e) {
    await cleanupUploaded(uploaded);
    if (isUniqueViolation(e) && clientId) {
      const dup = await prisma.chatMessage.findUnique({
        where: { senderId_clientId: { senderId: userId, clientId } },
        select: { id: true },
      });
      if (dup) return { message: await loadShapedMessage(dup.id), duplicate: true };
    }
    throw e;
  }

  const message = await loadShapedMessage(createdId);

  // Realtime: everyone in the conversation (including the sender's other devices).
  broadcastToConversation(conversationId, 'message:new', message).catch((e) =>
    logWarn('broadcast message:new failed', e),
  );

  // Push + inbox: fire and forget, never block the HTTP response.
  notifyChatMessage({
    conversationId,
    conversationType: conv.type,
    groupName: conv.group?.name ?? null,
    senderId: userId,
    senderName: message.sender.fullName,
    messageType: type,
    text: text || null,
    photoCount: photos.length,
  }).catch((e) => logWarn('notifyChatMessage failed', e));

  return { message, duplicate: false };
}

export async function editMessage(messageId: string, userId: string, text: string) {
  const clean = text.trim();
  if (clean.length > MAX_TEXT_LENGTH) throw ApiError.badRequest('Message is too long.');

  const existing = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!existing || existing.deletedAt) throw ApiError.notFound('Message not found.');
  if (existing.senderId !== userId) {
    throw ApiError.forbidden('You can only edit your own messages.');
  }
  await requireMembership(existing.conversationId, userId);

  // TEXT must keep some text; media captions may be cleared.
  if (existing.type === ChatMessageType.TEXT && !clean) {
    throw ApiError.badRequest('Message cannot be empty.');
  }
  if (clean === (existing.text ?? '')) {
    return { message: await loadShapedMessage(messageId) };
  }

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { text: clean || null, editedAt: new Date() }, // SRS 19.12: no time limit
  });

  const message = await loadShapedMessage(messageId);
  broadcastToConversation(existing.conversationId, 'message:edited', message).catch((e) =>
    logWarn('broadcast message:edited failed', e),
  );
  return { message };
}

async function softDeleteMessage(messageId: string): Promise<{ conversationId: string } | null> {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) return null;

  // SRS 19.15: media stays in storage until normal retention ends.
  await prisma.$transaction([
    prisma.chatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date() } }),
    prisma.messagePin.deleteMany({ where: { messageId } }),
  ]);

  const payload = { conversationId: message.conversationId, messageId };
  broadcastToConversation(message.conversationId, 'message:deleted', payload).catch((e) =>
    logWarn('broadcast message:deleted failed', e),
  );
  emitPinsUpdated(message.conversationId).catch((e) => logWarn('pins update failed', e));
  return { conversationId: message.conversationId };
}

export async function deleteMessage(messageId: string, userId: string, isLeader: boolean) {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw ApiError.notFound('Message not found.');

  if (message.senderId !== userId) {
    if (!isLeader) throw ApiError.forbidden('You can only delete your own messages.');
  } else {
    await requireMembership(message.conversationId, userId);
  }

  await softDeleteMessage(messageId);
  return { ok: true };
}

// ------------------------------------------------------------------
// Read state
// ------------------------------------------------------------------

export async function markRead(conversationId: string, userId: string) {
  await requireMembership(conversationId, userId);

  const latest = await prisma.chatMessage.findFirst({
    where: { conversationId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  });
  const now = new Date();

  await prisma.chatReadState.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt: now, lastReadMessageId: latest?.id ?? null },
    update: { lastReadAt: now, lastReadMessageId: latest?.id ?? null },
  });

  // Clear the coalesced inbox row for this conversation.
  await prisma.notification.updateMany({
    where: {
      recipientId: userId,
      type: 'CHAT_MESSAGE',
      relatedEntityType: 'ChatConversation',
      relatedEntityId: conversationId,
      readAt: null,
    },
    data: { readAt: now },
  });

  broadcastToConversation(
    conversationId,
    'read:updated',
    { conversationId, userId, lastReadAt: now.toISOString() },
    userId,
  ).catch((e) => logWarn('broadcast read:updated failed', e));

  return { ok: true, lastReadAt: now.toISOString() };
}

// ------------------------------------------------------------------
// Reactions (SRS 19.20)
// ------------------------------------------------------------------

export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  const e = emoji.trim();
  if (!e || e.length > 16 || !/\p{Extended_Pictographic}/u.test(e)) {
    throw ApiError.badRequest('Invalid emoji.');
  }

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { conversationId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw ApiError.notFound('Message not found.');
  await requireMembership(message.conversationId, userId);

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji: e } },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    try {
      await prisma.messageReaction.create({ data: { messageId, userId, emoji: e } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }

  const reactions = await prisma.messageReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });
  broadcastToConversation(message.conversationId, 'reaction:updated', {
    conversationId: message.conversationId,
    messageId,
    reactions,
  }).catch((err) => logWarn('broadcast reaction:updated failed', err));

  return { reactions };
}

// ------------------------------------------------------------------
// Pins (SRS 19.24)
// ------------------------------------------------------------------

async function loadPinned(conversationId: string) {
  const pins = await prisma.messagePin.findMany({
    where: { conversationId, message: { deletedAt: null } },
    orderBy: { pinnedAt: 'desc' },
    take: MAX_PINS,
    include: { message: { include: messageInclude } },
  });
  return pins.map((p) => shapeMessage(p.message));
}

async function emitPinsUpdated(conversationId: string): Promise<void> {
  const pinned = await loadPinned(conversationId);
  await broadcastToConversation(conversationId, 'pin:updated', { conversationId, pinned });
}

export async function pinMessage(messageId: string, userId: string) {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { conversationId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw ApiError.notFound('Message not found.');
  await requireMembership(message.conversationId, userId);

  await prisma.$transaction(async (tx) => {
    const already = await tx.messagePin.findUnique({
      where: {
        conversationId_messageId: { conversationId: message.conversationId, messageId },
      },
    });
    if (already) return;
    const count = await tx.messagePin.count({
      where: { conversationId: message.conversationId, message: { deletedAt: null } },
    });
    if (count >= MAX_PINS) {
      throw new ApiError(409, 'PIN_LIMIT', `You can pin up to ${MAX_PINS} messages. Unpin one first.`);
    }
    await tx.messagePin.create({
      data: { conversationId: message.conversationId, messageId, pinnedByUserId: userId },
    });
  });

  const pinned = await loadPinned(message.conversationId);
  broadcastToConversation(message.conversationId, 'pin:updated', {
    conversationId: message.conversationId,
    pinned,
  }).catch((e) => logWarn('broadcast pin:updated failed', e));
  return { pinned };
}

export async function unpinMessage(messageId: string, userId: string) {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message) throw ApiError.notFound('Message not found.');
  await requireMembership(message.conversationId, userId);

  await prisma.messagePin.deleteMany({ where: { messageId } });

  const pinned = await loadPinned(message.conversationId);
  broadcastToConversation(message.conversationId, 'pin:updated', {
    conversationId: message.conversationId,
    pinned,
  }).catch((e) => logWarn('broadcast pin:updated failed', e));
  return { pinned };
}

// ------------------------------------------------------------------
// Reports (SRS 19.23)
// ------------------------------------------------------------------

export async function reportMessage(messageId: string, reporterId: string) {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { conversationId: true, senderId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw ApiError.notFound('Message not found.');
  await requireMembership(message.conversationId, reporterId);
  if (message.senderId === reporterId) {
    throw ApiError.badRequest('You cannot report your own message.');
  }

  try {
    await prisma.messageReport.create({
      data: {
        messageId,
        reporterId,
        retainUntil: new Date(Date.now() + REPORT_RETENTION_DAYS * DAY_MS),
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw ApiError.conflict('You already reported this message.', 'ALREADY_REPORTED');
    }
    throw e;
  }
  return { ok: true };
}

/** Leader/admin: unresolved reports grouped by reported message. */
export async function listReports() {
  const reports = await prisma.messageReport.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      reporter: {
        select: { id: true, status: true, memberProfile: { select: { fullName: true } } },
      },
      message: {
        include: {
          ...messageInclude,
          conversation: {
            select: { id: true, type: true, group: { select: { name: true } } },
          },
        },
      },
    },
  });

  const byMessage = new Map<
    string,
    {
      messageId: string;
      conversationId: string;
      conversationType: ConversationType;
      conversationTitle: string;
      message: ShapedMessage;
      reportCount: number;
      reporters: string[];
      firstReportedAt: Date;
    }
  >();

  for (const r of reports) {
    const existing = byMessage.get(r.messageId);
    const reporterName = displayName(r.reporter);
    if (existing) {
      existing.reportCount += 1;
      existing.reporters.push(reporterName);
      continue;
    }
    const conv = r.message.conversation;
    byMessage.set(r.messageId, {
      messageId: r.messageId,
      conversationId: conv.id,
      conversationType: conv.type,
      conversationTitle:
        conv.type === 'GENERAL' ? 'General Choir Chat' : conv.group?.name ?? 'Direct message',
      message: shapeMessage(r.message),
      reportCount: 1,
      reporters: [reporterName],
      firstReportedAt: r.createdAt,
    });
  }
  return { items: Array.from(byMessage.values()) };
}

/** SRS 19.23 — after a leader resolves, the report records are deleted immediately. */
export async function resolveReport(
  messageId: string,
  resolution: MessageReportResolution,
) {
  if (!['KEPT', 'DELETED', 'DISMISSED'].includes(resolution)) {
    throw ApiError.badRequest('Invalid resolution.');
  }
  const count = await prisma.messageReport.count({ where: { messageId } });
  if (count === 0) throw ApiError.notFound('Report not found.');

  if (resolution === 'DELETED') await softDeleteMessage(messageId);
  await prisma.messageReport.deleteMany({ where: { messageId } });
  return { ok: true };
}

// ------------------------------------------------------------------
// Groups
// ------------------------------------------------------------------

function normalizeGroupName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) throw ApiError.badRequest('Group name is required.');
  if (name.length > MAX_GROUP_NAME) {
    throw ApiError.badRequest(`Group name must be at most ${MAX_GROUP_NAME} characters.`);
  }
  return name;
}

// SRS 19.5 — active group names must be unique (case-insensitive).
async function assertGroupNameFree(name: string, exceptGroupId?: string): Promise<void> {
  const clash = await prisma.chatGroup.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(exceptGroupId ? { id: { not: exceptGroupId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new ApiError(409, 'GROUP_NAME_TAKEN', 'A group with that name already exists.');
  }
}

async function loadGroup(conversationId: string) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { group: true },
  });
  if (!conversation || !conversation.group) throw ApiError.notFound('Group not found.');
  return { conversation, group: conversation.group };
}

export async function createGroup(
  leaderId: string,
  input: {
    name: string;
    memberIds: string[];
    photo?: { buffer: Buffer; mimetype: string } | null;
  },
) {
  const name = normalizeGroupName(input.name);
  await assertGroupNameFree(name);

  const memberIds = Array.from(new Set([...input.memberIds, leaderId]));
  const approved = await prisma.user.findMany({
    where: { id: { in: memberIds }, status: 'APPROVED', deletedAt: null },
    select: { id: true },
  });
  if (approved.length !== memberIds.length) {
    throw ApiError.badRequest('One or more members are not approved.');
  }

  let photoUrl: string | null = null;
  let photoPublicId: string | null = null;
  if (input.photo) {
    try {
      const up = await uploadBuffer(input.photo.buffer, 'rehobot/chat-group-photos', 'grp', 'image');
      photoUrl = up.url;
      photoPublicId = up.publicId;
    } catch {
      throw new ApiError(502, 'UPLOAD_FAILED', 'Could not upload the group photo.');
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.create({
        data: {
          type: ConversationType.GROUP,
          members: { create: memberIds.map((id) => ({ userId: id })) },
        },
      });
      const group = await tx.chatGroup.create({
        data: {
          conversationId: conversation.id,
          name,
          photoUrl,
          photoPublicId,
          managerId: leaderId,
          createdByUserId: leaderId,
        },
      });
      return { conversation, group };
    });

    sendToUsers(memberIds, 'conversation:added', { conversationId: created.conversation.id });
    return { id: created.conversation.id, groupId: created.group.id };
  } catch (e) {
    if (photoPublicId) await deleteByPublicId(photoPublicId);
    if (isUniqueViolation(e)) {
      throw new ApiError(409, 'GROUP_NAME_TAKEN', 'A group with that name already exists.');
    }
    throw e;
  }
}

/**
 * SRS 19.6 — any group member may rename the group / change its photo.
 * SRS 19.7 — only the manager or a leader may transfer management, and only
 *            to a Choir Leader who is already in the group.
 */
export async function updateGroup(
  conversationId: string,
  userId: string,
  isLeader: boolean,
  input: {
    name?: string;
    photo?: { buffer: Buffer; mimetype: string } | null;
    removePhoto?: boolean;
    managerId?: string;
  },
) {
  const { group } = await loadGroup(conversationId);

  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  const isMember = Boolean(member && !member.leftAt);
  const isManager = group.managerId === userId;
  if (!isMember && !isLeader) {
    throw ApiError.forbidden('You are not a member of this group.');
  }

  let newName: string | undefined;
  if (input.name !== undefined) {
    newName = normalizeGroupName(input.name);
    if (newName !== group.name) await assertGroupNameFree(newName, group.id);
  }

  if (input.managerId && input.managerId !== group.managerId) {
    if (!isLeader && !isManager) {
      throw ApiError.forbidden('Only the group manager or a leader can transfer management.');
    }
    const target = await prisma.user.findUnique({
      where: { id: input.managerId },
      select: { role: true, status: true, deletedAt: true },
    });
    if (!target || target.deletedAt || target.status !== 'APPROVED' || target.role !== 'LEADER') {
      throw ApiError.badRequest('New manager must be an approved leader.');
    }
    const row = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: input.managerId } },
    });
    if (!row || row.leftAt) {
      throw ApiError.badRequest('New manager must already be a member of the group.');
    }
  }

  let photoUrl = group.photoUrl;
  let photoPublicId = group.photoPublicId;
  const oldPublicId = group.photoPublicId;
  let replaceOld = false;

  if (input.photo) {
    try {
      const up = await uploadBuffer(input.photo.buffer, 'rehobot/chat-group-photos', 'grp', 'image');
      photoUrl = up.url;
      photoPublicId = up.publicId;
      replaceOld = true;
    } catch {
      throw new ApiError(502, 'UPLOAD_FAILED', 'Could not upload the group photo.');
    }
  } else if (input.removePhoto) {
    photoUrl = null;
    photoPublicId = null;
    replaceOld = true;
  }

  try {
    await prisma.chatGroup.update({
      where: { id: group.id },
      data: {
        name: newName,
        photoUrl,
        photoPublicId,
        managerId: input.managerId ?? undefined,
      },
    });
  } catch (e) {
    if (input.photo && photoPublicId) await deleteByPublicId(photoPublicId);
    if (isUniqueViolation(e)) {
      throw new ApiError(409, 'GROUP_NAME_TAKEN', 'A group with that name already exists.');
    }
    throw e;
  }

  if (replaceOld && oldPublicId && oldPublicId !== photoPublicId) {
    await deleteByPublicId(oldPublicId);
  }

  broadcastToConversation(conversationId, 'conversation:updated', { conversationId }).catch((e) =>
    logWarn('broadcast conversation:updated failed', e),
  );

  const updated = await prisma.chatGroup.findUnique({ where: { id: group.id } });
  return {
    id: updated!.id,
    name: updated!.name,
    photoUrl: updated!.photoUrl,
    managerId: updated!.managerId,
  };
}

export async function addGroupMembers(
  conversationId: string,
  userId: string,
  isLeader: boolean,
  memberIds: string[],
) {
  const { group } = await loadGroup(conversationId);
  if (!isLeader && group.managerId !== userId) {
    throw ApiError.forbidden('Only the group manager or a leader can add members.');
  }

  const ids = Array.from(new Set(memberIds));
  if (ids.length === 0) throw ApiError.badRequest('Select at least one member.');

  const approved = await prisma.user.findMany({
    where: { id: { in: ids }, status: 'APPROVED', deletedAt: null },
    select: { id: true },
  });
  if (approved.length !== ids.length) {
    throw ApiError.badRequest('One or more members are not approved.');
  }

  const existing = await prisma.conversationMember.findMany({
    where: { conversationId, userId: { in: ids } },
    select: { id: true, userId: true, leftAt: true },
  });
  const byUser = new Map(existing.map((e) => [e.userId, e]));
  const toCreate: string[] = [];
  const toRejoin: string[] = [];
  for (const id of ids) {
    const row = byUser.get(id);
    if (!row) toCreate.push(id);
    else if (row.leftAt) toRejoin.push(row.id);
  }
  const addedUserIds = [
    ...toCreate,
    ...existing.filter((e) => toRejoin.includes(e.id)).map((e) => e.userId),
  ];

  await prisma.$transaction(async (tx) => {
    if (toCreate.length > 0) {
      await tx.conversationMember.createMany({
        data: toCreate.map((id) => ({ conversationId, userId: id })),
        skipDuplicates: true,
      });
    }
    if (toRejoin.length > 0) {
      await tx.conversationMember.updateMany({
        where: { id: { in: toRejoin } },
        data: { leftAt: null, joinedAt: new Date() },
      });
    }
  });

  if (addedUserIds.length > 0) {
    sendToUsers(addedUserIds, 'conversation:added', { conversationId });
    broadcastToConversation(conversationId, 'conversation:updated', { conversationId }).catch((e) =>
      logWarn('broadcast conversation:updated failed', e),
    );
  }
  return { added: addedUserIds.length };
}

export async function removeGroupMember(
  conversationId: string,
  actingUserId: string,
  isLeader: boolean,
  targetUserId: string,
) {
  const { group } = await loadGroup(conversationId);

  const isSelf = actingUserId === targetUserId;
  const isManager = group.managerId === actingUserId;
  if (!isSelf && !isLeader && !isManager) {
    throw ApiError.forbidden('You can only remove yourself, unless you are the manager or a leader.');
  }

  if (targetUserId === group.managerId) {
    if (!isSelf) throw ApiError.badRequest('Cannot remove the group manager.');
    // SRS 19.7 — the manager must hand management to another leader first.
    const mgr = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });
    if (mgr && (mgr.role === 'LEADER' || mgr.role === 'ADMIN')) {
      throw ApiError.badRequest(
        'Transfer group management to another leader before leaving.',
        'TRANSFER_REQUIRED',
      );
    }
  }

  const result = await prisma.conversationMember.updateMany({
    where: { conversationId, userId: targetUserId, leftAt: null },
    data: { leftAt: new Date() },
  });
  if (result.count === 0) throw ApiError.notFound('Member not found in this group.');

  // Their pins/read state do not matter; just tell the clients.
  sendToUsers([targetUserId], 'conversation:removed', { conversationId });
  broadcastToConversation(conversationId, 'conversation:updated', { conversationId }).catch((e) =>
    logWarn('broadcast conversation:updated failed', e),
  );
  return { ok: true };
}

export async function deleteGroup(conversationId: string, userId: string, isLeader: boolean) {
  const { group } = await loadGroup(conversationId);
  if (!isLeader && group.managerId !== userId) {
    throw ApiError.forbidden('Only the manager or a leader can delete the group.');
  }

  // Collect everything we need BEFORE the cascade wipes the rows.
  const [members, media] = await Promise.all([
    prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    }),
    prisma.chatMedia.findMany({
      where: { message: { conversationId } },
      select: { storagePublicId: true, type: true },
    }),
  ]);

  // SRS 19.8 — group, messages and media are permanently deleted. DB rows
  // cascade from the conversation.
  await prisma.chatConversation.delete({ where: { id: conversationId } });

  sendToUsers(
    members.map((m) => m.userId),
    'conversation:removed',
    { conversationId },
  );

  // Storage cleanup is best-effort and must not block the response.
  Promise.all([
    ...media.map((m) => deleteByPublicId(m.storagePublicId, m.type === 'VOICE' ? 'video' : 'image')),
    group.photoPublicId ? deleteByPublicId(group.photoPublicId) : Promise.resolve(),
  ]).catch((e) => logWarn('group media cleanup failed', e));

  return { ok: true };
}