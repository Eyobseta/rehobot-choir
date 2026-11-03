import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { AttendanceStatus, GatheringType, UserRole } from '@prisma/client';
import { EthDate, ethToUtcDate, ethTodayFromInstant } from '../utils/ethiopianCalendar';
import { ethFields } from '../utils/eth-fields';

/**
 * A record is locked once its Addis-calendar day has ended.
 * Compares date-only values (both sides are UTC midnight of the Gregorian
 * mirror of an Ethiopian date), so the check is timezone-independent on
 * the server — the "today" used is the current EAT day.
 */
function isLocked(dateGregorian: Date): boolean {
  const todayEth = ethTodayFromInstant(new Date());
  const todayUtc = ethToUtcDate(todayEth);
  return dateGregorian.getTime() < todayUtc.getTime();
}

function isGatheringType(v: unknown): v is GatheringType {
  return (
    v === 'TUESDAY_ZEMA' ||
    v === 'THURSDAY_CHOIR' ||
    v === 'SATURDAY_CHOIR'
  );
}

function isStatus(v: unknown): v is AttendanceStatus {
  return v === 'PRESENT' || v === 'ABSENT';
}

/**
 * Upper bound on rows accepted in one attendance submission.
 * A real roster is well under this; the guard exists to cap the transaction
 * at a bounded amount of DB work per request.
 */
const MAX_ATTENDANCE_ROWS = 200;

export async function listMembersForAttendance(gathering: GatheringType) {
  const members = await prisma.user.findMany({
    where: {
      status: 'APPROVED',
      deletedAt: null,
      role: { in: [UserRole.MEMBER, UserRole.LEADER] },
    },
    orderBy: [{ lastActiveAt: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      memberProfile: {
        select: { fullName: true, profilePhotoUrl: true },
      },
    },
  });
  return members.map((m) => ({
    id: m.id,
    fullName: m.memberProfile?.fullName ?? '',
    profilePhotoUrl: m.memberProfile?.profilePhotoUrl ?? null,
  }));
}

export async function getAttendanceForDate(
  gathering: GatheringType,
  date: EthDate,
) {
  const dateGregorian = ethToUtcDate(date);
  const locked = isLocked(dateGregorian);

  const [records, roster] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { gathering, dateGregorian },
      select: { memberId: true, status: true },
    }),
    listMembersForAttendance(gathering),
  ]);

  const byMember = new Map(records.map((r) => [r.memberId, r.status]));

  return {
    gathering,
    date,
    locked,
    roster: roster.map((m) => ({
      ...m,
      status: byMember.get(m.id) ?? null,
    })),
  };
}

export async function recordAttendance(
  leaderUserId: string,
  input: {
    gathering: GatheringType;
    date: EthDate;
    records: { memberId: string; status: AttendanceStatus }[];
  },
) {
  if (!isGatheringType(input.gathering)) {
    throw ApiError.badRequest('Invalid gathering.');
  }

  const dateGregorian = ethToUtcDate(input.date);
  if (isLocked(dateGregorian)) {
    throw new ApiError(400, 'ATTENDANCE_LOCKED', 'Attendance is locked after the day ends.');
  }
  if (!Array.isArray(input.records) || input.records.length === 0) {
    throw ApiError.badRequest('No attendance rows provided.');
  }
  if (input.records.length > MAX_ATTENDANCE_ROWS) {
    throw ApiError.badRequest(
      `Too many attendance rows in one submission (max ${MAX_ATTENDANCE_ROWS}). Split into smaller batches.`,
      'TOO_MANY_ROWS',
    );
  }
  for (const row of input.records) {
    if (!row || typeof row.memberId !== 'string' || !row.memberId) {
      throw ApiError.badRequest('Invalid member id.');
    }
    if (!isStatus(row.status)) {
      throw ApiError.badRequest('Invalid attendance status.');
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of input.records) {
      await tx.attendanceRecord.upsert({
        where: {
          memberId_gathering_dateGregorian: {
            memberId: row.memberId,
            gathering: input.gathering,
            dateGregorian,
          },
        },
        create: {
          memberId: row.memberId,
          gathering: input.gathering,
          status: row.status,
          recordedByUserId: leaderUserId,
          ...(ethFields(input.date, 'date') as any),
        },
        update: {
          status: row.status,
          recordedByUserId: leaderUserId,
        },
      });
    }
  });

  return { ok: true, count: input.records.length };
}

export async function getMyAttendanceHistory(userId: string, limit = 60) {
  const records = await prisma.attendanceRecord.findMany({
    where: { memberId: userId },
    orderBy: { dateGregorian: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
    select: {
      id: true,
      gathering: true,
      dateEthYear: true,
      dateEthMonth: true,
      dateEthDay: true,
      dateGregorian: true,
      status: true,
    },
  });
  return records;
}

export async function getMemberAttendanceHistory(memberId: string, limit = 60) {
  const user = await prisma.user.findUnique({ where: { id: memberId } });
  if (!user) throw ApiError.notFound('Member not found.');
  return getMyAttendanceHistory(memberId, limit);
}

export async function getGridSummary(
  gathering: GatheringType,
  from: EthDate,
  to: EthDate,
) {
  const fromGregorian = ethToUtcDate(from);
  const toGregorian = ethToUtcDate(to);

  if (fromGregorian.getTime() > toGregorian.getTime()) {
    throw ApiError.badRequest('from must be <= to.');
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      gathering,
      dateGregorian: { gte: fromGregorian, lte: toGregorian },
    },
    select: { dateGregorian: true, status: true },
  });

  const byDate = new Map<string, { present: number; absent: number }>();
  for (const r of records) {
    const key = r.dateGregorian.toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? { present: 0, absent: 0 };
    if (r.status === 'PRESENT') bucket.present += 1;
    else bucket.absent += 1;
    byDate.set(key, bucket);
  }

  const rosterSize = (await listMembersForAttendance(gathering)).length;

  const days = Array.from(byDate.entries())
    .map(([date, counts]) => ({
      date,
      present: counts.present,
      absent: counts.absent,
      total: rosterSize,
      marked: counts.present + counts.absent,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return { gathering, from, to, rosterSize, days };
}

export async function getMyGridSummary(
  userId: string,
  from: EthDate,
  to: EthDate,
) {
  const fromGregorian = ethToUtcDate(from);
  const toGregorian = ethToUtcDate(to);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      memberId: userId,
      dateGregorian: { gte: fromGregorian, lte: toGregorian },
    },
    orderBy: { dateGregorian: 'desc' },
    select: {
      dateEthYear: true,
      dateEthMonth: true,
      dateEthDay: true,
      dateGregorian: true,
      status: true,
      gathering: true,
    },
  });

  const byDate = new Map<
    string,
    { status: AttendanceStatus; gathering: GatheringType; date: EthDate }
  >();
  for (const r of records) {
    const key = r.dateGregorian.toISOString().slice(0, 10);
    if (!byDate.has(key)) {
      byDate.set(key, {
        status: r.status,
        gathering: r.gathering,
        date: { year: r.dateEthYear, month: r.dateEthMonth, day: r.dateEthDay },
      });
    }
  }

  const days = Array.from(byDate.entries())
    .map(([isoDate, v]) => ({
      isoDate,
      date: v.date,
      status: v.status,
      gathering: v.gathering,
    }))
    .sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1));

  return { from, to, days };
}