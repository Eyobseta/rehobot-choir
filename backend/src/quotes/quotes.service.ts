import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { DailyQuoteStatus, NotificationType, UserRole } from '@prisma/client';
import { uploadBuffer } from '../storage/cloudinary';
import { fanOut } from '../notifications/notifications.service';
import { todayEthiopian } from '../utils/ethiopianCalendar';
import { ethFields } from '../utils/eth-fields';

// ---------- Reads ----------

export async function getTodayQuote() {
  const today = todayEthiopian();
  
  const row = await prisma.dailyQuote.findFirst({
    where: {
      dateEthYear: today.year,
      dateEthMonth: today.month,
      dateEthDay: today.day,
      status: DailyQuoteStatus.PUBLISHED,
    },
    include: {
      submittedBy: {
        select: {
          id: true,
          memberProfile: { select: { fullName: true, profilePhotoUrl: true } },
        },
      },
    },
  });
  return row;
}

export async function listRecentQuotes(days = 7) {
  const n = Math.min(Math.max(days, 1), 60);
  
  return prisma.dailyQuote.findMany({
    where: { status: DailyQuoteStatus.PUBLISHED },
    orderBy: { dateGregorian: 'desc' },
    take: n,
    include: {
      submittedBy: {
        select: {
          id: true,
          memberProfile: { select: { fullName: true, profilePhotoUrl: true } },
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

  const today = todayEthiopian();

  const existing = await prisma.dailyQuote.findFirst({
    where: {
      dateEthYear: today.year,
      dateEthMonth: today.month,
      dateEthDay: today.day,
    },
  });
  if (existing && existing.status === DailyQuoteStatus.PUBLISHED) {
    throw new ApiError(409, 'QUOTE_ALREADY_PUBLISHED', 'A quote for today has already been published.');
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

  try {
    const created = await prisma.dailyQuote.create({
      data: {
        quoteText,
        source,
        youtubeUrl: input.youtubeUrl?.trim() || null,
        audioUrl,
        audioPublicId,
        submittedByUserId: userId,
        status: DailyQuoteStatus.PUBLISHED,
        ...(ethFields(today, 'date') as any),
      },
    });

    await fanOutQuoteNotification(created.id, source, quoteText);
    return created;
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw new ApiError(409, 'QUOTE_ALREADY_PUBLISHED', 'A quote for today has already been published.');
    }
    throw e;
  }
}

// ---------- Notification ----------

async function fanOutQuoteNotification(quoteId: string, source: string, quoteText: string) {
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