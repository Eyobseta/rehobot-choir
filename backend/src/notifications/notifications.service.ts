import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { NotificationType } from '@prisma/client';

// ---------- Delivery via Expo Push ----------

type ExpoMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

/**
 * Send push notifications to Expo.
 * Accepts 1..N messages. Handles batching internally.
 */
export async function sendExpoPush(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const BATCH = 100;
  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.warn(`[push] expo responded ${res.status}`);
        continue;
      }

      const json = (await res.json()) as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];
      const failed = tickets.filter((t) => t.status === 'error');

      for (const f of failed) {
        if (f.details?.error === 'DeviceNotRegistered') {
          await cleanupDeadTokenByTicket(f);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[push] send failed', e);
    }
  }
}

/**
 * Placeholder — we clean up tokens by overwrite on registration and by
 * expiry in the D4 scheduler. This is kept for future refinement.
 */
async function cleanupDeadTokenByTicket(_ticket: ExpoTicket): Promise<void> {
  // no-op
}

// ---------- Preferences helper ----------

async function ensurePreferenceRow(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

type PrefColumn =
  | 'announcementsEnabled'
  | 'eventRemindersEnabled'
  | 'chatMessagesEnabled'
  | 'birthdaysEnabled'
  | 'newSongEnabled'
  | 'newMemoryEnabled'
  | 'dailyQuoteEnabled';

/**
 * Given a notification type, return the preference column name.
 */
function typeToPrefColumn(type: NotificationType): PrefColumn | null {
  switch (type) {
    case 'ANNOUNCEMENT':
      return 'announcementsEnabled';
    case 'EVENT_REMINDER':
      return 'eventRemindersEnabled';
    case 'CHAT_MESSAGE':
      return 'chatMessagesEnabled';
    case 'BIRTHDAY':
      return 'birthdaysEnabled';
    case 'SONG_PUBLISHED':
      return 'newSongEnabled';
    case 'MEMORY_PUBLISHED':
      return 'newMemoryEnabled';
    case 'DAILY_QUOTE':
      return 'dailyQuoteEnabled';
    case 'LEADERSHIP_CHANGE':
      return null;
    default:
      return null;
  }
}

// ---------- Fan-out ----------

export type FanOutInput = {
  recipients: string[];
  type: NotificationType;
  title: string;
  body?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  force?: boolean;
};

/**
 * Create Notification rows for the recipients and push them via Expo.
 * Honors per-type preferences (except when force = true).
 *
 * This is the ONLY place that should create push notifications.
 */
export async function fanOut(input: FanOutInput): Promise<void> {
  if (input.recipients.length === 0) return;

  // 1) Filter by preferences.
  let deliverTo: string[] = input.recipients;

  if (!input.force) {
    const prefCol = typeToPrefColumn(input.type);
    if (prefCol) {
      const prefs = await prisma.notificationPreference.findMany({
        where: { userId: { in: input.recipients } },
        select: { userId: true, [prefCol]: true } as any,
      });

      const disabled = new Set<string>(
        prefs
          .filter((p: any) => p[prefCol] === false)
          .map((p: any) => String(p.userId)),
      );

      deliverTo = input.recipients.filter((id) => !disabled.has(id));
    }
  }

  if (deliverTo.length === 0) return;

  // 2) Create in-app Notification rows.
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.notification.createMany({
    data: deliverTo.map((rid) => ({
      recipientId: rid,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      expiresAt,
    })),
  });

  // 3) Look up push tokens for the deliverable users.
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: deliverTo } },
    select: { token: true, userId: true, platform: true },
  });
  if (tokens.length === 0) return;

  // 4) Send push.
  const messages: ExpoMessage[] = tokens.map((t) => ({
    to: t.token,
    title: input.title,
    body: input.body,
    sound: 'default',
    priority: 'high',
    channelId: t.platform === 'android' ? 'default' : undefined,
    data: {
      type: input.type,
      entityType: input.relatedEntityType ?? null,
      entityId: input.relatedEntityId ?? null,
    },
  }));

  await sendExpoPush(messages);
}

// ---------- Inbox ----------

export async function listMyNotifications(userId: string, limit = 60) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return prisma.notification.findMany({
    where: {
      recipientId: userId,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      relatedEntityType: true,
      relatedEntityId: true,
      createdAt: true,
      readAt: true,
    },
  });
}

export async function markNotificationRead(userId: string, id: string) {
  const row = await prisma.notification.findUnique({ where: { id } });
  if (!row || row.recipientId !== userId) {
    throw ApiError.notFound('Notification not found.');
  }
  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true, updated: result.count };
}

export async function deleteNotification(userId: string, id: string) {
  const row = await prisma.notification.findUnique({ where: { id } });
  if (!row || row.recipientId !== userId) {
    throw ApiError.notFound('Notification not found.');
  }
  await prisma.notification.delete({ where: { id } });
  return { ok: true };
}

// ---------- Preferences ----------

export async function getPreferences(userId: string) {
  const pref = await ensurePreferenceRow(userId);
  return {
    announcementsEnabled: pref.announcementsEnabled,
    eventRemindersEnabled: pref.eventRemindersEnabled,
    chatMessagesEnabled: pref.chatMessagesEnabled,
    birthdaysEnabled: pref.birthdaysEnabled,
    newSongEnabled: pref.newSongEnabled,
    newMemoryEnabled: pref.newMemoryEnabled,
    dailyQuoteEnabled: pref.dailyQuoteEnabled,
  };
}

export type PreferenceUpdate = Partial<{
  announcementsEnabled: boolean;
  eventRemindersEnabled: boolean;
  birthdaysEnabled: boolean;
  newSongEnabled: boolean;
  newMemoryEnabled: boolean;
  dailyQuoteEnabled: boolean;
}>;

export async function updatePreferences(
  userId: string,
  input: PreferenceUpdate,
) {
  await ensurePreferenceRow(userId);
  const updated = await prisma.notificationPreference.update({
    where: { userId },
    data: {
      announcementsEnabled: input.announcementsEnabled,
      eventRemindersEnabled: input.eventRemindersEnabled,
      birthdaysEnabled: input.birthdaysEnabled,
      newSongEnabled: input.newSongEnabled,
      newMemoryEnabled: input.newMemoryEnabled,
      dailyQuoteEnabled: input.dailyQuoteEnabled,
    },
  });
  return {
    announcementsEnabled: updated.announcementsEnabled,
    eventRemindersEnabled: updated.eventRemindersEnabled,
    chatMessagesEnabled: updated.chatMessagesEnabled,
    birthdaysEnabled: updated.birthdaysEnabled,
    newSongEnabled: updated.newSongEnabled,
    newMemoryEnabled: updated.newMemoryEnabled,
    dailyQuoteEnabled: updated.dailyQuoteEnabled,
  };
}

// ---------- Push token registration ----------

export async function registerPushToken(
  userId: string,
  token: string,
  platform: string,
  deviceLabel?: string,
) {
  if (!token.trim()) throw ApiError.badRequest('Token is required.');
  if (!['android', 'ios', 'web'].includes(platform)) {
    throw ApiError.badRequest('Invalid platform.');
  }

  const existing = await prisma.pushToken.findUnique({ where: { token } });

  if (existing && existing.userId !== userId) {
    await prisma.pushToken.update({
      where: { token },
      data: { userId, platform, deviceLabel },
    });
  } else if (existing) {
    await prisma.pushToken.update({
      where: { token },
      data: { platform, deviceLabel },
    });
  } else {
    await prisma.pushToken.create({
      data: { userId, token, platform, deviceLabel },
    });
  }

  return { ok: true };
}

export async function unregisterPushToken(token: string) {
  await prisma.pushToken.deleteMany({ where: { token } });
  return { ok: true };
}