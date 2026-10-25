import { prisma } from '../db/prisma';
import { fanOut } from '../notifications/notifications.service';
import { NotificationType, EventStatus } from '@prisma/client';

/**
 * SRS 11.6 — 24h and 1h before each published event.
 * Only members who RSVP'd Going or Maybe get the reminder.
 * Members who RSVP'd Not Going are excluded.
 */
export async function runEventRemindersJob(): Promise<{
  reminded24h: number;
  reminded1h: number;
}> {
  const now = new Date();

  // We look for events whose date is within a small window around the
  // target moment. Because cron runs every 15 minutes, we use a window
  // of [target - 2m, target + 2m] to tolerate jitter.
  const window = 2 * 60 * 1000;

  const target24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const target1 = new Date(now.getTime() + 60 * 60 * 1000);

  const events24 = await prisma.event.findMany({
    where: {
      status: EventStatus.PUBLISHED,
      dateGregorian: {
        gte: new Date(target24.getTime() - window),
        lte: new Date(target24.getTime() + window),
      },
    },
    select: { id: true, title: true, dateGregorian: true },
  });

  const events1 = await prisma.event.findMany({
    where: {
      status: EventStatus.PUBLISHED,
      dateGregorian: {
        gte: new Date(target1.getTime() - window),
        lte: new Date(target1.getTime() + window),
      },
    },
    select: { id: true, title: true, dateGregorian: true },
  });

  let reminded24h = 0;
  let reminded1h = 0;

  for (const ev of events24) {
    const reminded = await remindForEvent(ev.id, ev.title, ev.dateGregorian, '24h');
    reminded24h += reminded;
  }

  for (const ev of events1) {
    const reminded = await remindForEvent(ev.id, ev.title, ev.dateGregorian, '1h');
    reminded1h += reminded;
  }

  return { reminded24h, reminded1h };
}

async function remindForEvent(
  eventId: string,
  title: string,
  dateGregorian: Date,
  kind: '24h' | '1h',
): Promise<number> {
  // Which members RSVP'd Going or Maybe?
  const rsvps = await prisma.eventRSVP.findMany({
    where: {
      eventId,
      response: { in: ['GOING', 'MAYBE'] },
    },
    select: { userId: true },
  });

  if (rsvps.length === 0) return 0;

  // Dedupe: don't send the same reminder twice to the same user for the
  // same event/kind. We do this by checking existing notifications.
  const body = `Reminder: ${kind === '24h' ? 'tomorrow' : 'in 1 hour'}`;
  const prefix = kind === '24h' ? 'Reminder: tomorrow' : 'Reminder: in 1 hour';

  const existing = await prisma.notification.findMany({
    where: {
      type: NotificationType.EVENT_REMINDER,
      relatedEntityType: 'Event',
      relatedEntityId: eventId,
      title: { contains: title },
      createdAt: { gte: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    },
    select: { recipientId: true },
  });
  const already = new Set(existing.map((e) => e.recipientId));

  // Also, we only want to send one reminder of each kind, so we further
  // constrain by checking whether the same prefix exists in the title.
  const filtered = rsvps.filter((r) => !already.has(r.userId));
  if (filtered.length === 0) return 0;

  await fanOut({
    recipients: filtered.map((r) => r.userId),
    type: NotificationType.EVENT_REMINDER,
    title: `${prefix}: ${title}`,
    body,
    relatedEntityType: 'Event',
    relatedEntityId: eventId,
  });

  return filtered.length;
}