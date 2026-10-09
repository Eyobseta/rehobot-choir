import { prisma } from '../db/prisma';
import { fanOut } from '../notifications/notifications.service';
import { NotificationType, UserRole } from '@prisma/client';

/**
 * SRS 16.5 — Day-before and day-of birthday notifications.
 * The birthday person receives no birthday notification.
 */
export async function runBirthdayJob(): Promise<{
  today: number;
  tomorrow: number;
}> {
  const now = new Date();
  const utcToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const utcTomorrow = new Date(utcToday);
  utcTomorrow.setUTCDate(utcToday.getUTCDate() + 1);

  const todayMonth = utcToday.getUTCMonth();
  const todayDay = utcToday.getUTCDate();
  const tmrMonth = utcTomorrow.getUTCMonth();
  const tmrDay = utcTomorrow.getUTCDate();

  const profiles = await prisma.memberProfile.findMany({
    where: {
      user: {
        status: 'APPROVED',
        deletedAt: null,
      },
    },
    select: {
      userId: true,
      fullName: true,
      dateOfBirth: true,
    },
  });

  const bdayToday = profiles.filter(
    (p) =>
      p.dateOfBirth.getUTCMonth() === todayMonth &&
      p.dateOfBirth.getUTCDate() === todayDay,
  );
  const bdayTomorrow = profiles.filter(
    (p) =>
      p.dateOfBirth.getUTCMonth() === tmrMonth &&
      p.dateOfBirth.getUTCDate() === tmrDay,
  );

  const allRecipients = await prisma.user.findMany({
    where: {
      status: 'APPROVED',
      deletedAt: null,
      role: { in: [UserRole.MEMBER, UserRole.LEADER] },
    },
    select: { id: true },
  });
  const allRecipientIds = allRecipients.map((r) => r.id);

  for (const p of bdayToday) {
    const recipients = allRecipientIds.filter((id) => id !== p.userId);
    await fanOut({
      recipients,
      type: NotificationType.BIRTHDAY,
      title: `${p.fullName}'s birthday is today!`,
      body: 'Send them a birthday wish.',
      relatedEntityType: null,
      relatedEntityId: null,
    });
  }

  for (const p of bdayTomorrow) {
    const recipients = allRecipientIds.filter((id) => id !== p.userId);
    await fanOut({
      recipients,
      type: NotificationType.BIRTHDAY,
      title: `${p.fullName}'s birthday is tomorrow`,
      body: 'Plan ahead — send them a birthday wish.',
      relatedEntityType: null,
      relatedEntityId: null,
    });
  }

  return {
    today: bdayToday.length,
    tomorrow: bdayTomorrow.length,
  };
}