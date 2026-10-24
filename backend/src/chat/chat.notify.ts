import { ChatMessageType, ConversationType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { isUserViewingConversation } from '../realtime/sseHub';
import { sendExpoPush } from '../notifications/notifications.service';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type ChatNotifyInput = {
  conversationId: string;
  conversationType: ConversationType;
  groupName: string | null;
  senderId: string;
  senderName: string;
  messageType: ChatMessageType;
  text: string | null;
  photoCount: number;
};

function preview(input: ChatNotifyInput): string {
  const t = (input.text ?? '').trim();
  if (t) return t.length > 120 ? `${t.slice(0, 117)}…` : t;
  if (input.messageType === 'VOICE') return '🎤 Voice message';
  if (input.messageType === 'PHOTO') {
    return input.photoCount > 1 ? `📷 ${input.photoCount} photos` : '📷 Photo';
  }
  return 'New message';
}

/**
 * SRS 19.16 — chat notifications are ALWAYS on (no preference check, no mute).
 *
 * - Push goes to every active member except the sender and except people who
 *   currently have this conversation open on a connected device.
 * - The in-app inbox keeps ONE unread row per conversation per recipient
 *   (updated in place) so a busy General chat cannot flood the inbox.
 */
export async function notifyChatMessage(input: ChatNotifyInput): Promise<void> {
  const members = await prisma.conversationMember.findMany({
    where: {
      conversationId: input.conversationId,
      leftAt: null,
      userId: { not: input.senderId },
    },
    select: { userId: true },
  });

  const targets = members
    .map((m) => m.userId)
    .filter((id) => !isUserViewingConversation(id, input.conversationId));
  if (targets.length === 0) return;

  const body = preview(input);
  let title: string;
  let pushBody: string;
  if (input.conversationType === 'DIRECT') {
    title = input.senderName;
    pushBody = body;
  } else if (input.conversationType === 'GROUP') {
    title = input.groupName ?? 'Group';
    pushBody = `${input.senderName}: ${body}`;
  } else {
    title = 'General Choir Chat';
    pushBody = `${input.senderName}: ${body}`;
  }

  // ---- In-app inbox (coalesced) ----
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
  const existing = await prisma.notification.findMany({
    where: {
      recipientId: { in: targets },
      type: 'CHAT_MESSAGE',
      relatedEntityType: 'ChatConversation',
      relatedEntityId: input.conversationId,
      readAt: null,
    },
    select: { id: true, recipientId: true },
  });
  const have = new Set(existing.map((e) => e.recipientId));

  if (existing.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: existing.map((e) => e.id) } },
      data: { title, body: pushBody, createdAt: new Date(), expiresAt },
    });
  }
  const toCreate = targets.filter((id) => !have.has(id));
  if (toCreate.length > 0) {
    await prisma.notification.createMany({
      data: toCreate.map((recipientId) => ({
        recipientId,
        type: 'CHAT_MESSAGE' as const,
        title,
        body: pushBody,
        relatedEntityType: 'ChatConversation',
        relatedEntityId: input.conversationId,
        expiresAt,
      })),
    });
  }

  // ---- Push ----
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: targets } },
    select: { token: true, platform: true },
  });
  if (tokens.length === 0) return;

  await sendExpoPush(
    tokens.map((t) => ({
      to: t.token,
      title,
      body: pushBody,
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: t.platform === 'android' ? 'default' : undefined,
      data: {
        type: 'CHAT_MESSAGE',
        entityType: 'ChatConversation',
        entityId: input.conversationId,
        conversationId: input.conversationId,
      },
    })),
  );
}