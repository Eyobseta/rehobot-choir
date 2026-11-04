import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';

/**
 * Role-based visibility:
 *   MEMBER → entries tagged MEMBER
 *   LEADER → entries tagged MEMBER or LEADER (a leader is also a member)
 *   ADMIN  → everything
 */
function roleFilter(role: UserRole): Prisma.HelpEntryWhereInput {
  if (role === 'ADMIN') return {};
  if (role === 'LEADER') {
    return { visibleToRoles: { hasSome: ['MEMBER', 'LEADER'] } };
  }
  return { visibleToRoles: { has: 'MEMBER' } };
}

/** Redact PII before persisting. Never store raw phone numbers or emails. */
const REDACT_PATTERNS: RegExp[] = [
  /(\+?251|0)?9\d{8}/g,
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
];

function redact(text: string): string {
  let out = text;
  for (const p of REDACT_PATTERNS) out = out.replace(p, '[redacted]');
  return out.slice(0, 500);
}

export async function listEntriesForRole(role: UserRole) {
  return prisma.helpEntry.findMany({
    where: { active: true, ...roleFilter(role) },
    orderBy: [{ sortOrder: 'asc' }, { category: 'asc' }, { slug: 'asc' }],
    select: {
      id: true,
      slug: true,
      category: true,
      intentsEn: true,
      intentsAm: true,
      questionVariantsEn: true,
      questionVariantsAm: true,
      answerEn: true,
      answerAm: true,
      deepLink: true,
      visibleToRoles: true,
      screenHints: true,
    },
  });
}

/**
 * Opaque version string for cache invalidation. Combines the caller's role
 * (different roles see different subsets) with a cheap fingerprint of the
 * visible entries.
 */
export async function getKbVersion(role: UserRole): Promise<string> {
  const agg = await prisma.helpEntry.aggregate({
    where: { active: true, ...roleFilter(role) },
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  const count = agg._count._all;
  const updated = agg._max.updatedAt?.toISOString() ?? 'none';
  return `${role}:${count}:${updated}`;
}

const MAX_SCREEN_LEN = 200;

export type LogQueryInput = {
  screen?: string;
  language: string;
  rawQuery?: string;
  /** Either the HelpEntry.id (cuid) or its slug. The mobile bundled KB uses slugs. */
  matchedEntryId?: string;
  matchScore?: number;
};

/**
 * The mobile app may answer from its bundled KB, whose entry ids are slugs,
 * not database cuids. Resolve either form to a real id (or null) so the
 * foreign key never fails and logging never blocks the thumbs-up/down flow.
 */
async function resolveEntryId(idOrSlug?: string): Promise<string | null> {
  if (!idOrSlug) return null;
  const e = await prisma.helpEntry.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true },
  });
  return e?.id ?? null;
}

export async function logQuery(
  userId: string,
  role: UserRole,
  input: LogQueryInput,
) {
  const lang = input.language === 'am' ? 'am' : 'en';
  const redacted =
    typeof input.rawQuery === 'string' && input.rawQuery.trim()
      ? redact(input.rawQuery.trim())
      : null;

  const matchedEntryId = await resolveEntryId(input.matchedEntryId);

  return prisma.helpQueryLog.create({
    data: {
      userId,
      roleAtQuery: role,
      screen: input.screen ? String(input.screen).slice(0, MAX_SCREEN_LEN) : null,
      language: lang,
      rawQuery: redacted,
      matchedEntryId,
      matchScore: Number.isFinite(input.matchScore) ? input.matchScore : null,
    },
    select: { id: true },
  });
}

export async function recordFeedback(
  userId: string,
  queryId: string,
  feedback: 'UP' | 'DOWN' | 'NONE',
) {
  const row = await prisma.helpQueryLog.findUnique({
    where: { id: queryId },
    select: { userId: true },
  });
  if (!row || row.userId !== userId) {
    throw ApiError.notFound('Query not found.');
  }

  return prisma.helpQueryLog.update({
    where: { id: queryId },
    data: { feedback },
    select: { id: true, feedback: true },
  });
}

// Retention (90 days) lives in scheduler/cleanup.job.ts → runHelpCleanupJob().