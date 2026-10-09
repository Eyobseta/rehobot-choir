import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import {
  AttendanceStatus,
  GatheringType,
  UserRole,
} from '@prisma/client';

/**
 * Normalize a date string (YYYY-MM-DD) to UTC midnight.
 * Attendance is stored at 00:00 UTC of the gathering day.
 */
function startOfDayUTC(dateStr: string): Date {
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw ApiError.badRequest('Invalid date. Use YYYY-MM-DD.');
  const [, y, mo, d] = m;
  const dt = new Date(`${y}-${mo}-${d}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) {
    throw ApiError.badRequest('Invalid date.');
  }
  return dt;
}

/**
 * A given day is locked once we are past its end (server-side).
 * SRS 12.2 — attendance is locked after the day ends.
 */
function isLocked(dateMidnightUTC: Date): boolean {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return dateMidnightUTC.getTime() < today.getTime();
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
 * List approved members to be recorded for a specific gathering + date.
 * For now we include all approved members. When Zema Team is built, this
 * will narrow TUESDAY_ZEMA to the Zema Team.
 */
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

/**
 * Get attendance for a gathering on a specific date, plus the roster.
 */
export async function getAttendanceForDate(
  gathering: GatheringType,
  dateStr: string,
) {
  const date = startOfDayUTC(dateStr);
  const locked = isLocked(date);

  const [records, roster] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { gathering, date },
      select: { memberId: true, status: true },
    }),
    listMembersForAttendance(gathering),
  ]);

  const byMember = new Map(records.map((r) => [r.memberId, r.status]));

  return {
    gathering,
    date: dateStr,
    locked,
    roster: roster.map((m) => ({
      ...m,
      status: byMember.get(m.id) ?? null,
    })),
  };
}

/**
 * Record (upsert) attendance for a gathering + date.
 * Rejects if the date is locked.
 */
export async function recordAttendance(
  leaderUserId: string,
  input: {
    gathering: GatheringType;
    date: string;
    records: { memberId: string; status: AttendanceStatus }[];
  },
) {
  if (!isGatheringType(input.gathering)) {
    throw ApiError.badRequest('Invalid gathering.');
  }
  const date = startOfDayUTC(input.date);
  if (isLocked(date)) {
    throw new ApiError(
      400,
      'ATTENDANCE_LOCKED',
      'Attendance is locked after the day ends.',
    );
  }
  if (!Array.isArray(input.records) || input.records.length === 0) {
    throw ApiError.badRequest('No attendance rows provided.');
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
          memberId_gathering_date: {
            memberId: row.memberId,
            gathering: input.gathering,
            date,
          },
        },
        create: {
          memberId: row.memberId,
          gathering: input.gathering,
          date,
          status: row.status,
          recordedByUserId: leaderUserId,
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

/**
 * Member's own attendance history (SRS 12.3).
 */
export async function getMyAttendanceHistory(userId: string, limit = 60) {
  const records = await prisma.attendanceRecord.findMany({
    where: { memberId: userId },
    orderBy: { date: 'desc' },
    take: Math.min(Math.max(limit, 1), 200),
    select: {
      id: true,
      gathering: true,
      date: true,
      status: true,
    },
  });
  return records;
}

/**
 * Leader view: another member's history (SRS 12.3).
 */
export async function getMemberAttendanceHistory(memberId: string, limit = 60) {
  const user = await prisma.user.findUnique({ where: { id: memberId } });
  if (!user) throw ApiError.notFound('Member not found.');
  return getMyAttendanceHistory(memberId, limit);
}

/**
 * Grid summary for a gathering type across a date range.
 * Returns one entry per gathering date with counts.
 */
export async function getGridSummary(
  gathering: GatheringType,
  fromStr: string,
  toStr: string,
) {
  const from = startOfDayUTC(fromStr);
  const to = startOfDayUTC(toStr);
  if (from.getTime() > to.getTime()) {
    throw ApiError.badRequest('from must be <= to.');
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      gathering,
      date: { gte: from, lte: to },
    },
    select: { date: true, status: true },
  });

  const byDate = new Map<string, { present: number; absent: number }>();
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);
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

  return { gathering, from: fromStr, to: toStr, rosterSize, days };
}

/**
 * Grid summary for the logged-in member.
 * One entry per gathering day.
 */
export async function getMyGridSummary(
  userId: string,
  fromStr: string,
  toStr: string,
) {
  const from = startOfDayUTC(fromStr);
  const to = startOfDayUTC(toStr);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      memberId: userId,
      date: { gte: from, lte: to },
    },
    orderBy: { date: 'desc' },
    select: { date: true, status: true, gathering: true },
  });

  const byDate = new Map<
    string,
    { status: AttendanceStatus; gathering: GatheringType }
  >();
  for (const r of records) {
    const key = r.date.toISOString().slice(0, 10);
    if (!byDate.has(key)) {
      byDate.set(key, { status: r.status, gathering: r.gathering });
    }
  }

  const days = Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      status: v.status,
      gathering: v.gathering,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return { from: fromStr, to: toStr, days };
}