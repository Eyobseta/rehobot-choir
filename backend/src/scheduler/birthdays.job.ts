import { prisma } from '../db/prisma';
import { fanOut } from '../notifications/notifications.service';
import { NotificationType, UserRole } from '@prisma/client';
import { todayEthiopian, addEthDays } from '../utils/ethiopianCalendar';

export async function runBirthdayJob(): Promise<{ today: number; tomorrow: number }> {
  const today = todayEthiopian();
  const tomorrow = addEthDays(today, 1);

  const profiles = await prisma.memberProfile.findMany({
    where: { user: { status: 'APPROVED', deletedAt: null } },
    select: {
      userId: true,
      fullName: true,
      dateOfBirthEthMonth: true,
      dateOfBirthEthDay: true,
    },
  });

  const bdayToday = profiles.filter(
    (p) => p.dateOfBirthEthMonth === today.month && p.dateOfBirthEthDay === today.day,
  );
  const bdayTomorrow = profiles.filter(
    (p) => p.dateOfBirthEthMonth === tomorrow.month && p.dateOfBirthEthDay === tomorrow.day,
  );

  const allRecipients = await prisma.user.findMany({
    where: { status: 'APPROVED', deletedAt: null, role: { in: [UserRole.MEMBER, UserRole.LEADER] } },
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

  return { today: bdayToday.length, tomorrow: bdayTomorrow.length };
}