import { prisma } from '../db/prisma';
import { fanOut } from '../notifications/notifications.service';
import { NotificationType, UserRole } from '@prisma/client';
import { todayEthiopian, addEthDays, EthDate } from '../utils/ethiopianCalendar';
import { ethFields } from '../utils/eth-fields';

/**
 * Ensure a BirthdayPost row exists for this user/year/day, returning its id.
 * Mirrors `ensureBirthdayPostFor` in members.service — kept here as a small
 * duplicate so the job does not depend on the members module.
 */
async function ensureBirthdayPost(
  userId: string,
  year: number,
  month: number,
  day: number,
): Promise<string> {
  const existing = await prisma.birthdayPost.findUnique({
    where: { userId_year: { userId, year } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const bday: EthDate = { year, month, day };
  const created = await prisma.birthdayPost.create({
    data: {
      userId,
      year,
      ...(ethFields(bday, 'birthday') as any),
    },
    select: { id: true },
  });
  return created.id;
}

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
    const postId = await ensureBirthdayPost(
      p.userId,
      today.year,
      p.dateOfBirthEthMonth,
      p.dateOfBirthEthDay,
    );
    const recipients = allRecipientIds.filter((id) => id !== p.userId);
    await fanOut({
      recipients,
      type: NotificationType.BIRTHDAY,
      title: `${p.fullName}'s birthday is today!`,
      body: 'Send them a birthday wish.',
      relatedEntityType: 'BirthdayPost',
      relatedEntityId: postId,
    });
  }

  for (const p of bdayTomorrow) {
    const postId = await ensureBirthdayPost(
      p.userId,
      tomorrow.year,
      p.dateOfBirthEthMonth,
      p.dateOfBirthEthDay,
    );
    const recipients = allRecipientIds.filter((id) => id !== p.userId);
    await fanOut({
      recipients,
      type: NotificationType.BIRTHDAY,
      title: `${p.fullName}'s birthday is tomorrow`,
      body: 'Plan ahead — send them a birthday wish.',
      relatedEntityType: 'BirthdayPost',
      relatedEntityId: postId,
    });
  }

  return { today: bdayToday.length, tomorrow: bdayTomorrow.length };
}