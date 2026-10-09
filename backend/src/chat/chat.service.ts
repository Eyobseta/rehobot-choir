import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import {
  ChatMessageType,
  ChatMediaType,
  ConversationType,
  UserRole,
} from '@prisma/client';
import { uploadBuffer, deleteByPublicId } from '../storage/cloudinary';
import { sendToUsers, broadcastToConversation } from '../realtime/sseHub';

const VOICE_MAX_SECONDS = 60;
const CHAT_MEDIA_RETENTION_DAYS = 365;
const MESSAGE_PAGE_SIZE = 30;
const MAX_MESSAGE_PAGE_SIZE = 60;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function directKeyFor(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * General chat is a singleton conversation, created lazily.
 */
async function getOrCreateGeneralConversation() {
  const existing = await prisma.chatConversation.findFirst({
    where: { type: ConversationType.GENERAL },
  });
  if (existing) return existing;

  try {
    return await prisma.chatConversation.create({
      data: { type: ConversationType.GENERAL },
    });
  } catch {
    // Race: another worker created it first. Re-read.
    const again = await prisma.chatConversation.findFirst({
      where: { type: ConversationType.GENERAL },
    });
    if (!again) throw ApiError.internal('Could not create general chat.');
    return again;
  }
}

/**
 * Ensure every approved member is a member of General chat.
 * We do this lazily on any request that touches General — it is cheap and
 * keeps the schema simple. Runs inside a transaction.
 */
async function ensureGeneralMembership(conversationId: string) {
  const approved = await prisma.user.findMany({
    where: {
      status: 'APPROVED',
      deletedAt: null,
      role: { in: [UserRole.MEMBER, UserRole.LEADER] },
    },
    select: { id: true },
  });

  const existing = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const have = new Set(existing.map((e) => e.userId));

  const missing = approved.filter((u) => !have.has(u.id));
  if (missing.length === 0) return;

  await prisma.conversationMember.createMany({
    data: missing.map((u) => ({ conversationId, userId: u.id })),
  });
}

/**
 * Check the caller is an active member of the conversation.
 */
async function requireMembership(conversationId: string, userId: string) {
  const member = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
  });
  if (!member || member.leftAt) {
    throw ApiError.forbidden('You are not a member of this conversation.');
  }
  return member;
}

/**
 * Check the caller is an approved member (for starting DMs, etc.).
 */
async function requireApproved(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt || user.status !== 'APPROVED') {
    throw ApiError.forbidden('Only approved members can use chat.');
  }
  return user;
}

/**
 * Ensure General chat exists and the caller is a member.
 */
async function ensureGeneralReadyFor(userId: string) {
  const general = await getOrCreateGeneralConversation();
  await ensureGeneralMembership(general.id);
  const m = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId: general.id, userId },
    },
  });
  if (!m) {
    throw ApiError.internal('General chat membership not found.');
  }
  return general;
}

// ------------------------------------------------------------------
// Conversation listing / opening
// ------------------------------------------------------------------

export async function listConversations(userId: string) {
  await requireApproved(userId);

  // Make sure General exists and includes this user.
  await ensureGeneralReadyFor(userId);

  // Fetch all conversations this user is an active member of.
  const memberships = await prisma.conversationMember.findMany({
    where: { userId, leftAt: null },
    select: { conversationId: true },
  });
  const conversationIds = memberships.map((m) => m.conversationId);
  if (conversationIds.length === 0) return [];

  const conversations = await prisma.chatConversation.findMany({
    where: { id: { in: conversationIds } },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
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
      members: {
        where: { leftAt: null },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              lastActiveAt: true,
              memberProfile: {
                select: { fullName: true, profilePhotoUrl: true },
              },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          type: true,
          text: true,
          createdAt: true,
          deletedAt: true,
          senderId: true,
        },
      },
    },
  });

  return conversations.map((c) => shapeConversationForList(c, userId));
}

function shapeConversationForList(c: any, viewerId: string) {
  const otherMembers = c.members.filter((m: any) => m.userId !== viewerId);
  const lastMessage = c.messages[0] ?? null;

  let title = '';
  let photoUrl: string | null = null;

  if (c.type === 'DIRECT') {
    const other = otherMembers[0];
    title = other?.user?.memberProfile?.fullName ?? 'Member';
    photoUrl = other?.user?.memberProfile?.profilePhotoUrl ?? null;
  } else if (c.type === 'GENERAL') {
    title = 'General Choir Chat';
    photoUrl = null;
  } else if (c.type === 'GROUP') {
    title = c.group?.name ?? 'Group';
    photoUrl = c.group?.photoUrl ?? null;
  }

  return {
    id: c.id,
    type: c.type,
    title,
    photoUrl,
    lastMessageAt: c.lastMessageAt ?? c.createdAt,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          type: lastMessage.type,
          text: lastMessage.deletedAt ? null : lastMessage.text,
          deleted: Boolean(lastMessage.deletedAt),
          senderId: lastMessage.senderId,
          createdAt: lastMessage.createdAt,
        }
      : null,
    memberCount: c.members.length,
    otherMemberIds: otherMembers.map((m: any) => m.userId),
  };
}

export async function getConversationDetail(conversationId: string, userId: string) {
  await requireApproved(userId);
  await requireMembership(conversationId, userId);

  const c = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      group: true,
      members: {
        where: { leftAt: null },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              lastActiveAt: true,
              memberProfile: {
                select: { fullName: true, profilePhotoUrl: true },
              },
            },
          },
        },
      },
    },
  });
  if (!c) throw ApiError.notFound('Conversation not found.');

  return {
    id: c.id,
    type: c.type,
    group: c.group
      ? {
          id: c.group.id,
          name: c.group.name,
          photoUrl: c.group.photoUrl,
          managerId: c.group.managerId,
          createdByUserId: c.group.createdByUserId,
        }
      : null,
    members: c.members.map((m: any) => ({
      userId: m.userId,
      fullName: m.user?.memberProfile?.fullName ?? 'Member',
      profilePhotoUrl: m.user?.memberProfile?.profilePhotoUrl ?? null,
      lastActiveAt: m.user?.lastActiveAt ?? null,
    })),
  };
}

/**
 * Open a DM with another member. If one already exists, return it.
 * If not, create it with both members.
 */
export async function openDirectConversation(userId: string, otherUserId: string) {
  await requireApproved(userId);
  await requireApproved(otherUserId);

  if (userId === otherUserId) {
    throw ApiError.badRequest('Cannot open a DM with yourself.');
  }

  const directKey = directKeyFor(userId, otherUserId);

  const existing = await prisma.chatConversation.findUnique({
    where: { directKey },
  });
  if (existing) {
    // Ensure the caller is a member (edge case: if they had left).
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: existing.id, userId } },
    });
    if (!membership) {
      await prisma.conversationMember.create({
        data: { conversationId: existing.id, userId },
      });
    } else if (membership.leftAt) {
      await prisma.conversationMember.update({
        where: { id: membership.id },
        data: { leftAt: null },
      });
    }
    return { id: existing.id };
  }

  const created = await prisma.chatConversation.create({
    data: {
      type: ConversationType.DIRECT,
      directKey,
      members: {
        create: [{ userId }, { userId: otherUserId }],
      },
    },
  });
  return { id: created.id };
}

// ------------------------------------------------------------------
// Messages
// ------------------------------------------------------------------

export async function listMessages(
  conversationId: string,
  userId: string,
  before?: string,
  limit = MESSAGE_PAGE_SIZE,
) {
  await requireApproved(userId);
  await requireMembership(conversationId, userId);

  const take = Math.min(Math.max(limit, 1), MAX_MESSAGE_PAGE_SIZE);

  const where: any = { conversationId };
  if (before) {
    const cursor = await prisma.chatMessage.findUnique({
      where: { id: before },
      select: { createdAt: true },
    });
    if (cursor) {
      where.createdAt = { lt: cursor.createdAt };
    }
  }

  const rows = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      sender: {
        select: {
          id: true,
          memberProfile: {
            select: { fullName: true, profilePhotoUrl: true },
          },
        },
      },
      media: {
        select: {
          id: true,
          type: true,
          storageUrl: true,
          durationSeconds: true,
        },
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
              memberProfile: { select: { fullName: true } },
            },
          },
        },
      },
      reactions: {
        select: { emoji: true, userId: true },
      },
    },
  });

  const items = rows.map((m) => ({
    id: m.id,
    type: m.type,
    text: m.deletedAt ? null : m.text,
    deleted: Boolean(m.deletedAt),
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    sender: {
      id: m.sender.id,
      fullName: m.sender.memberProfile?.fullName ?? 'Member',
      profilePhotoUrl: m.sender.memberProfile?.profilePhotoUrl ?? null,
    },
    media: m.media,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          text: m.replyTo.deletedAt ? null : m.replyTo.text,
          deleted: Boolean(m.replyTo.deletedAt),
          type: m.replyTo.type,
          sender: {
            id: m.replyTo.sender.id,
            fullName:
              m.replyTo.sender.memberProfile?.fullName ?? 'Member',
          },
        }
      : null,
    reactions: m.reactions,
  }));

   const lastItem = items.length === take ? items[items.length - 1] : null;

  return {
    items,
    nextCursor: lastItem ? lastItem.id : null,
  };
}

export type SendMessageInput = {
  text?: string;
  replyToId?: string | null;
  photos?: { buffer: Buffer; mimetype: string }[];
  voice?: { buffer: Buffer; mimetype: string; durationSeconds: number } | null;
};

export async function sendMessage(
  conversationId: string,
  userId: string,
  input: SendMessageInput,
) {
  await requireApproved(userId);
  await requireMembership(conversationId, userId);

  const text = (input.text ?? '').trim();
  const photos = input.photos ?? [];
  const voice = input.voice ?? null;

  if (!text && photos.length === 0 && !voice) {
    throw ApiError.badRequest('Message cannot be empty.');
  }
  if (text.length > 4000) throw ApiError.badRequest('Message is too long.');
  if (photos.length > 10) throw ApiError.badRequest('Up to 10 photos per message.');
  if (voice && (voice.durationSeconds < 1 || voice.durationSeconds > VOICE_MAX_SECONDS)) {
    throw ApiError.badRequest('Voice messages must be between 1 and 60 seconds.');
  }

  // If replying, ensure the target message exists and is in the same conversation.
  if (input.replyToId) {
    const parent = await prisma.chatMessage.findUnique({
      where: { id: input.replyToId },
      select: { conversationId: true },
    });
    if (!parent || parent.conversationId !== conversationId) {
      throw ApiError.badRequest('Cannot reply to that message.');
    }
  }

  // Decide the message type. Voice alone → VOICE. Photos alone → PHOTO.
  // Text-only → TEXT. Mixed → PHOTO (larger visual payload).
  let type: ChatMessageType = ChatMessageType.TEXT;
  if (voice) type = ChatMessageType.VOICE;
  else if (photos.length > 0) type = ChatMessageType.PHOTO;

  // Upload media first (external I/O before DB write).
  const retentionUntil = new Date(
    Date.now() + CHAT_MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const mediaRows: {
    type: ChatMediaType;
    storageUrl: string;
    storagePublicId: string;
    durationSeconds?: number;
    retentionUntil: Date;
  }[] = [];

  for (const p of photos) {
    const uploaded = await uploadBuffer(
      p.buffer,
      'rehobot/chat-photos',
      `chat_${Date.now()}`,
      'image',
    );
    mediaRows.push({
      type: ChatMediaType.PHOTO,
      storageUrl: uploaded.url,
      storagePublicId: uploaded.publicId,
      retentionUntil,
    });
  }

  if (voice) {
    const uploaded = await uploadBuffer(
      voice.buffer,
      'rehobot/chat-voice',
      `chatv_${Date.now()}`,
      'video',
    );
    mediaRows.push({
      type: ChatMediaType.VOICE,
      storageUrl: uploaded.url,
      storagePublicId: uploaded.publicId,
      durationSeconds: voice.durationSeconds,
      retentionUntil,
    });
  }

  // Create message + media + bump conversation.
  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        type,
        text: text || null,
        replyToId: input.replyToId ?? null,
        media:
          mediaRows.length > 0 ? { create: mediaRows } : undefined,
      },
      include: {
        sender: {
          select: {
            id: true,
            memberProfile: {
              select: { fullName: true, profilePhotoUrl: true },
            },
          },
        },
        media: true,
      },
    });

    await tx.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  });

  return {
    id: created.id,
    type: created.type,
    text: created.text,
    createdAt: created.createdAt,
    editedAt: created.editedAt,
    sender: {
      id: created.sender.id,
      fullName: created.sender.memberProfile?.fullName ?? 'Member',
      profilePhotoUrl:
        created.sender.memberProfile?.profilePhotoUrl ?? null,
    },
    media: created.media.map((m) => ({
      id: m.id,
      type: m.type,
      storageUrl: m.storageUrl,
      durationSeconds: m.durationSeconds,
    })),
    replyTo: null, // client can refetch for full context
    reactions: [],
  };
}

export async function editMessage(
  messageId: string,
  userId: string,
  text: string,
) {
  const clean = text.trim();
  if (!clean) throw ApiError.badRequest('Message cannot be empty.');
  if (clean.length > 4000) throw ApiError.badRequest('Message is too long.');

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });
  if (!message || message.deletedAt) {
    throw ApiError.notFound('Message not found.');
  }
  if (message.senderId !== userId) {
    throw ApiError.forbidden('You can only edit your own messages.');
  }
  if (message.type !== ChatMessageType.TEXT) {
    throw ApiError.badRequest('Only text messages can be edited.');
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { text: clean, editedAt: new Date() },
  });
  return { id: updated.id, text: updated.text, editedAt: updated.editedAt };
}

export async function deleteMessage(
  messageId: string,
  userId: string,
  isLeader: boolean,
) {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });
  if (!message || message.deletedAt) {
    throw ApiError.notFound('Message not found.');
  }
  if (!isLeader && message.senderId !== userId) {
    throw ApiError.forbidden('You can only delete your own messages.');
  }

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}

// ------------------------------------------------------------------
// Groups
// ------------------------------------------------------------------

export async function createGroup(
  leaderId: string,
  input: { name: string; memberIds: string[]; photo?: { buffer: Buffer; mimetype: string } | null },
) {
  const name = input.name.trim();
  if (!name) throw ApiError.badRequest('Group name is required.');

  // SRS 19.5 — active group names must be unique.
  const clash = await prisma.chatGroup.findUnique({ where: { name } });
  if (clash) {
    throw new ApiError(409, 'GROUP_NAME_TAKEN', 'A group with that name already exists.');
  }

  // Validate all proposed members exist and are approved.
  const memberIds = Array.from(new Set(input.memberIds));
  const approved = await prisma.user.findMany({
    where: {
      id: { in: memberIds },
      status: 'APPROVED',
      deletedAt: null,
    },
    select: { id: true },
  });
  const approvedIds = new Set(approved.map((u) => u.id));
  const invalid = memberIds.filter((id) => !approvedIds.has(id));
  if (invalid.length > 0) {
    throw ApiError.badRequest('One or more members are not approved.');
  }

  // Always include the creating leader.
  if (!approvedIds.has(leaderId)) {
    memberIds.push(leaderId);
  }

  let photoUrl: string | null = null;
  let photoPublicId: string | null = null;
  if (input.photo) {
    const uploaded = await uploadBuffer(
      input.photo.buffer,
      'rehobot/chat-group-photos',
      `grp_${Date.now()}`,
      'image',
    );
    photoUrl = uploaded.url;
    photoPublicId = uploaded.publicId;
  }

  const created = await prisma.$transaction(async (tx) => {
    const conversation = await tx.chatConversation.create({
      data: {
        type: ConversationType.GROUP,
        members: {
          create: memberIds.map((id) => ({ userId: id })),
        },
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

  return { id: created.conversation.id, groupId: created.group.id };
}

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
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { group: true },
  });
  if (!conversation || !conversation.group) {
    throw ApiError.notFound('Group not found.');
  }
  await requireMembership(conversationId, userId);

  const group = conversation.group;
  const isManager = group.managerId === userId;
  if (!isLeader && !isManager) {
    throw ApiError.forbidden('Only the group manager or a leader can edit this group.');
  }

  // Rename
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw ApiError.badRequest('Group name cannot be empty.');
    if (name !== group.name) {
      const clash = await prisma.chatGroup.findUnique({ where: { name } });
      if (clash) {
        throw new ApiError(409, 'GROUP_NAME_TAKEN', 'A group with that name already exists.');
      }
    }
  }

  // Photo
  let photoUrl = group.photoUrl;
  let photoPublicId = group.photoPublicId;
  if (input.photo) {
    const uploaded = await uploadBuffer(
      input.photo.buffer,
      'rehobot/chat-group-photos',
      `grp_${Date.now()}`,
      'image',
    );
    if (photoPublicId) await deleteByPublicId(photoPublicId);
    photoUrl = uploaded.url;
    photoPublicId = uploaded.publicId;
  } else if (input.removePhoto) {
    if (photoPublicId) await deleteByPublicId(photoPublicId);
    photoUrl = null;
    photoPublicId = null;
  }

  // Manager transfer
  if (input.managerId && input.managerId !== group.managerId) {
    if (!isLeader) {
      throw ApiError.forbidden('Only a leader can transfer group management.');
    }
    const target = await prisma.user.findUnique({
      where: { id: input.managerId },
    });
    if (!target || target.deletedAt || target.status !== 'APPROVED' || target.role !== 'LEADER') {
      throw ApiError.badRequest('New manager must be an approved leader.');
    }
    const memberRow = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: input.managerId,
        },
      },
    });
    if (!memberRow || memberRow.leftAt) {
      throw ApiError.badRequest('New manager must already be a member of the group.');
    }
  }

  const updated = await prisma.chatGroup.update({
    where: { id: group.id },
    data: {
      name: input.name?.trim() || undefined,
      photoUrl,
      photoPublicId,
      managerId: input.managerId ?? undefined,
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    photoUrl: updated.photoUrl,
    managerId: updated.managerId,
  };
}

export async function addGroupMembers(
  conversationId: string,
  userId: string,
  isLeader: boolean,
  memberIds: string[],
) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { group: true },
  });
  if (!conversation || !conversation.group) {
    throw ApiError.notFound('Group not found.');
  }
  const isManager = conversation.group.managerId === userId;
  if (!isLeader && !isManager) {
    throw ApiError.forbidden('Only the group manager or a leader can add members.');
  }

  const approved = await prisma.user.findMany({
    where: {
      id: { in: memberIds },
      status: 'APPROVED',
      deletedAt: null,
    },
    select: { id: true },
  });
  const approvedIds = approved.map((a) => a.id);
  if (approvedIds.length !== memberIds.length) {
    throw ApiError.badRequest('One or more members are not approved.');
  }

  const existing = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { id: true, userId: true, leftAt: true },
  });
  const have = new Set(existing.filter((e) => !e.leftAt).map((e) => e.userId));
  const toAdd: string[] = [];
  const toRejoin: string[] = [];
  for (const id of approvedIds) {
    if (have.has(id)) continue;
    const row = existing.find((e) => e.userId === id);
    if (row) toRejoin.push(row.id);
    else toAdd.push(id);
  }

  await prisma.$transaction(async (tx) => {
    if (toAdd.length > 0) {
      await tx.conversationMember.createMany({
        data: toAdd.map((id) => ({ conversationId, userId: id })),
      });
    }
    for (const id of toRejoin) {
      await tx.conversationMember.update({
        where: { id },
        data: { leftAt: null },
      });
    }
  });

  return { added: toAdd.length + toRejoin.length };
}

export async function removeGroupMember(
  conversationId: string,
  actingUserId: string,
  isLeader: boolean,
  targetUserId: string,
) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { group: true },
  });
  if (!conversation || !conversation.group) {
    throw ApiError.notFound('Group not found.');
  }

  const isSelf = actingUserId === targetUserId;
  const isManager = conversation.group.managerId === actingUserId;

  if (!isSelf && !isLeader && !isManager) {
    throw ApiError.forbidden('You can only remove yourself, or you must be the manager or a leader.');
  }

  if (targetUserId === conversation.group.managerId && !isSelf) {
    throw ApiError.badRequest('Cannot remove the group manager.');
  }

  // SRS 19.7 — if the creator leaves leadership, they must transfer
  // management before leaving. Enforce that here for the manager.
  if (isSelf && targetUserId === conversation.group.managerId) {
    if (!isLeader) {
      throw ApiError.badRequest(
        'You must transfer group management to another leader before leaving.',
      );
    }
  }

  await prisma.conversationMember.updateMany({
    where: { conversationId, userId: targetUserId, leftAt: null },
    data: { leftAt: new Date() },
  });

  return { ok: true };
}

export async function deleteGroup(
  conversationId: string,
  userId: string,
  isLeader: boolean,
) {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: { group: true },
  });
  if (!conversation || !conversation.group) {
    throw ApiError.notFound('Group not found.');
  }
  const isManager = conversation.group.managerId === userId;
  if (!isLeader && !isManager) {
    throw ApiError.forbidden('Only the manager or a leader can delete the group.');
  }

  // SRS 19.8 — deleting a group permanently deletes the group, its messages,
  // and its media. Cascade deletes handle this because every child relation
  // cascades from the conversation or from the group.
  await prisma.chatConversation.delete({ where: { id: conversationId } });
  return { ok: true };
}