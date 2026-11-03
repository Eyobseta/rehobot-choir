import { prisma } from '../db/prisma';
import { fanOut } from '../notifications/notifications.service';
import { NotificationType, EventStatus } from '@prisma/client';
import {
  addEthDays,
  ethToUtcDate,
  ethTodayFromInstant,
  formatEthDate,
  EthDate,
} from '../utils/ethiopianCalendar';

/**
 * SRS 11.6 — reminders before each published event.
 *
 * Original design used "24h + 1h before the event time". That design is
 * incompatible with the current schema: Event.dateGregorian is @db.Date
 * (a UTC-midnight date, no time component). Firing "1 hour before midnight
 * UTC" lands at 03:00 EAT, which is not a useful reminder time for anyone.
 *
 * Redesigned for Ethiopian users, using times that match the daily rhythm:
 *
 *   "Tomorrow" reminder — fires at 19:00 EAT the evening before.
 *                         After dinner, planning time.
 *   "Today"    reminder — fires at 07:00 EAT the morning of the event.
 *                         Dawn / wake-up, before morning prayers.
 *
 * Both fire from scheduler/index.ts via timezone-aware cron entries; this
 * module is the "what to send" and the scheduler is the "when to send".
 *
 * Only members who RSVP'd GOING or MAYBE receive reminders.
 * Members who RSVP'd NOT_GOING are excluded.
 */

export type ReminderMode = 'day_before' | 'same_day' | 'both';

export type ReminderResult = {
  dayBefore: number;
  sameDay: number;
};

export async function runEventRemindersJob(
  now: Date = new Date(),
  mode: ReminderMode = 'both',
): Promise<ReminderResult> {
  const result: ReminderResult = { dayBefore: 0, sameDay: 0 };

  const todayEth = ethTodayFromInstant(now);
  const todayUtc = ethToUtcDate(todayEth);

  if (mode === 'same_day' || mode === 'both') {
    const eventsToday = await prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        dateGregorian: todayUtc,
      },
      select: { id: true, title: true },
    });
    for (const ev of eventsToday) {
      result.sameDay += await remindForEvent(ev.id, ev.title, 'same_day', todayEth);
    }
  }

  if (mode === 'day_before' || mode === 'both') {
    const tomorrowEth = addEthDays(todayEth, 1);
    const tomorrowUtc = ethToUtcDate(tomorrowEth);

    const eventsTomorrow = await prisma.event.findMany({
      where: {
        status: EventStatus.PUBLISHED,
        dateGregorian: tomorrowUtc,
      },
      select: { id: true, title: true },
    });
    for (const ev of eventsTomorrow) {
      result.dayBefore += await remindForEvent(ev.id, ev.title, 'day_before', tomorrowEth);
    }
  }

  return result;
}

async function remindForEvent(
  eventId: string,
  eventTitle: string,
  kind: 'day_before' | 'same_day',
  eventDate: EthDate,
): Promise<number> {
  const rsvps = await prisma.eventRSVP.findMany({
    where: {
      eventId,
      response: { in: ['GOING', 'MAYBE'] },
    },
    select: { userId: true },
  });
  if (rsvps.length === 0) return 0;

  const dateLabel = formatEthDate(eventDate, 'en');
  const prefix = kind === 'day_before' ? 'Reminder: tomorrow' : 'Reminder: today';
  const notificationTitle = `${prefix}: ${eventTitle}`;
  const body =
    kind === 'day_before'
      ? `Your event is tomorrow (${dateLabel}).`
      : `Your event is today (${dateLabel}).`;

  // Dedup by *kind*, not by the raw event title — see Step 6 for the history.
  // `startsWith: prefix` distinguishes "Reminder: tomorrow: X" from
  // "Reminder: today: X" so a morning-of reminder is never mistaken for the
  // evening-before one (and vice versa).
  //
  // Known limitation: if a leader reschedules an event within 25h of a
  // reminder having already fired for the old date, the new date's reminder
  // will be suppressed by this dedup window. Rare enough to accept for now;
  // a reminder-log table (like FundingReminderLog) is the proper fix if it
  // ever becomes an issue.
  const existing = await prisma.notification.findMany({
    where: {
      type: NotificationType.EVENT_REMINDER,
      relatedEntityType: 'Event',
      relatedEntityId: eventId,
      title: { startsWith: prefix },
      createdAt: { gte: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    },
    select: { recipientId: true },
  });
  const already = new Set(existing.map((e) => e.recipientId));

  const filtered = rsvps.filter((r) => !already.has(r.userId));
  if (filtered.length === 0) return 0;

  await fanOut({
    recipients: filtered.map((r) => r.userId),
    type: NotificationType.EVENT_REMINDER,
    title: notificationTitle,
    body,
    relatedEntityType: 'Event',
    relatedEntityId: eventId,
  });

  return filtered.length;
}