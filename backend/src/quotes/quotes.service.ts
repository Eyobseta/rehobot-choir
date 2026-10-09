import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import {
  DailyQuoteStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { uploadBuffer } from '../storage/cloudinary';
import { fanOut } from '../notifications/notifications.service';
/**
 * Normalize a Date to just the day (YYYY-MM-DD at UTC midnight).
 */
function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dateFromISO(iso: string): Date {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw ApiError.badRequest('Invalid date. Use YYYY-MM-DD.');
  const [, y, mo, d] = m;
  const dt = new Date(`${y}-${mo}-${d}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) {
    throw ApiError.badRequest('Invalid date.');
  }
  return dt;
}

// ---------- Reads ----------

export async function getTodayQuote() {
  const today = startOfDayUTC(new Date());
  const row = await prisma.dailyQuote.findUnique({
    where: { dateOnly: today },
    include: {
      submittedBy: {
        select: {
          id: true,
          memberProfile: {
            select: { fullName: true, profilePhotoUrl: true },
          },
        },
      },
    },
  });
  if (!row || row.status === DailyQuoteStatus.DELETED) return null;
  return row;
}

export async function listRecentQuotes(days = 7) {
  const n = Math.min(Math.max(days, 1), 60);
  const today = startOfDayUTC(new Date());
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - (n - 1));

  return prisma.dailyQuote.findMany({
    where: {
      status: DailyQuoteStatus.PUBLISHED,
      dateOnly: { gte: from, lte: today },
    },
    orderBy: { dateOnly: 'desc' },
    take: n,
    include: {
      submittedBy: {
        select: {
          id: true,
          memberProfile: {
            select: { fullName: true, profilePhotoUrl: true },
          },
        },
      },
    },
  });
}

export async function getMyQuoteCount(userId: string) {
  const count = await prisma.dailyQuote.count({
    where: {
      submittedByUserId: userId,
      status: DailyQuoteStatus.PUBLISHED,
    },
  });
  return { count };
}

// ---------- Publish ----------

export type PublishQuoteInput = {
  quoteText: string;
  source: string;
  youtubeUrl?: string;
  audio?: { buffer: Buffer; mimetype: string } | null;
};

export async function publishTodayQuote(
  userId: string,
  input: PublishQuoteInput,
) {
  const quoteText = input.quoteText?.trim();
  const source = input.source?.trim();

  if (!quoteText) throw ApiError.badRequest('Quote is required.');
  if (!source) throw ApiError.badRequest('Source is required.');

  const today = startOfDayUTC(new Date());

  // Guard: only one per day.
  const existing = await prisma.dailyQuote.findUnique({
    where: { dateOnly: today },
  });
  if (existing && existing.status === DailyQuoteStatus.PUBLISHED) {
    throw new ApiError(
      409,
      'QUOTE_ALREADY_PUBLISHED',
      'A quote for today has already been published.',
    );
  }

  let audioUrl: string | null = null;
  let audioPublicId: string | null = null;
  if (input.audio) {
    const uploaded = await uploadBuffer(
      input.audio.buffer,
      'rehobot/quote-audio',
      `quote_${Date.now()}`,
      'video',
    );
    audioUrl = uploaded.url;
    audioPublicId = uploaded.publicId;
  }

  // Race condition: two clients may both pass the guard above. The unique
  // constraint on dateOnly is the real protection — if two writes arrive at
  // the same instant, the second will throw P2002. Handle it below.
  try {
    const created = await prisma.dailyQuote.create({
      data: {
        dateOnly: today,
        quoteText,
        source,
        youtubeUrl: input.youtubeUrl?.trim() || null,
        audioUrl,
        audioPublicId,
        submittedByUserId: userId,
        status: DailyQuoteStatus.PUBLISHED,
      },
    });

    await fanOutQuoteNotification(created.id, source, quoteText);
    return created;
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw new ApiError(
        409,
        'QUOTE_ALREADY_PUBLISHED',
        'A quote for today has already been published.',
      );
    }
    throw e;
  }
}

// ---------- Notification ----------

async function fanOutQuoteNotification(
  quoteId: string,
  source: string,
  quoteText: string,
) {
  const recipients = await prisma.user.findMany({
    where: {
      status: 'APPROVED',
      deletedAt: null,
      role: { in: [UserRole.MEMBER, UserRole.LEADER] },
    },
    select: { id: true },
  });
  const body = quoteText.length > 120 ? quoteText.slice(0, 117) + '…' : quoteText;
  await fanOut({
    recipients: recipients.map((r) => r.id),
    type: 'DAILY_QUOTE',
    title: `Today's Bible quote (${source})`,
    body,
    relatedEntityType: 'DailyQuote',
    relatedEntityId: quoteId,
  });
}