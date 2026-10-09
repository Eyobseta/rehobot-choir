import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { EventStatus, RsvpResponse } from '@prisma/client';
import { uploadBuffer, deleteByPublicId } from '../storage/cloudinary';

// SRS 11.5 — RSVP closes 24h before event.
const RSVP_CLOSE_MS = 24 * 60 * 60 * 1000;

function rsvpClosed(eventDate: Date): boolean {
  return eventDate.getTime() - Date.now() < RSVP_CLOSE_MS;
}

/**
 * List events visible to members.
 * Upcoming: date >= now, status PUBLISHED
 * Past: date < now, status PUBLISHED
 */
export async function listPublishedEvents(scope: 'upcoming' | 'past') {
  const now = new Date();
  const where =
    scope === 'upcoming'
      ? { status: EventStatus.PUBLISHED, date: { gte: now } }
      : { status: EventStatus.PUBLISHED, date: { lt: now } };

  const orderBy =
    scope === 'upcoming'
      ? ({ date: 'asc' } as const)
      : ({ date: 'desc' } as const);

  return prisma.event.findMany({
    where,
    orderBy,
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      date: true,
      coverImageUrl: true,
    },
  });
}

export async function getEventDetail(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      attachments: { select: { id: true, imageUrl: true } },
      rsvps: {
        select: {
          id: true,
          userId: true,
          response: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!event || event.status !== EventStatus.PUBLISHED) {
    throw ApiError.notFound('Event not found.');
  }

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    date: event.date,
    coverImageUrl: event.coverImageUrl,
    attachments: event.attachments,
    rsvpClosed: rsvpClosed(event.date),
    rsvps: event.rsvps,
  };
}

/**
 * Leader create event.
 * status = DRAFT by default; pass publish=true to publish immediately.
 */
export async function createEvent(
  leaderUserId: string,
  input: {
    title: string;
    description?: string;
    location?: string;
    date: string; // ISO
    publish?: boolean;
    coverImage?: { buffer: Buffer; mimetype: string } | null;
    attachments?: { buffer: Buffer; mimetype: string }[];
  },
) {
  if (!input.title || !input.title.trim()) {
    throw ApiError.badRequest('Title is required.');
  }
  if (!input.date || Number.isNaN(new Date(input.date).getTime())) {
    throw ApiError.badRequest('A valid date is required.');
  }

  let coverImageUrl: string | null = null;
  let coverImagePublicId: string | null = null;

  if (input.coverImage) {
    const uploaded = await uploadBuffer(
      input.coverImage.buffer,
      'rehobot/event-covers',
      `event_${Date.now()}`,
    );
    coverImageUrl = uploaded.url;
    coverImagePublicId = uploaded.publicId;
  }

  const attachmentData: { imageUrl: string; imagePublicId: string }[] = [];
  if (input.attachments && input.attachments.length > 0) {
    for (const file of input.attachments) {
      const uploaded = await uploadBuffer(
        file.buffer,
        'rehobot/event-attachments',
        `event_att_${Date.now()}`,
      );
      attachmentData.push({
        imageUrl: uploaded.url,
        imagePublicId: uploaded.publicId,
      });
    }
  }

  const publish = Boolean(input.publish);

  return prisma.event.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      date: new Date(input.date),
      coverImageUrl,
      coverImagePublicId,
      status: publish ? EventStatus.PUBLISHED : EventStatus.DRAFT,
      publishedAt: publish ? new Date() : null,
      createdByUserId: leaderUserId,
      attachments:
        attachmentData.length > 0
          ? { create: attachmentData }
          : undefined,
    },
  });
}

/**
 * Leader edit event.
 */
export async function updateEvent(
  eventId: string,
  input: {
    title?: string;
    description?: string | null;
    location?: string | null;
    date?: string;
    publish?: boolean;
    coverImage?: { buffer: Buffer; mimetype: string } | null;
    removeCover?: boolean;
  },
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.status === EventStatus.DELETED) {
    throw ApiError.notFound('Event not found.');
  }

  let coverImageUrl = event.coverImageUrl;
  let coverImagePublicId = event.coverImagePublicId;

  if (input.coverImage) {
    const uploaded = await uploadBuffer(
      input.coverImage.buffer,
      'rehobot/event-covers',
      `event_${Date.now()}`,
    );
    if (coverImagePublicId) {
      await deleteByPublicId(coverImagePublicId);
    }
    coverImageUrl = uploaded.url;
    coverImagePublicId = uploaded.publicId;
  } else if (input.removeCover) {
    if (coverImagePublicId) {
      await deleteByPublicId(coverImagePublicId);
    }
    coverImageUrl = null;
    coverImagePublicId = null;
  }

  const becomesPublished =
    input.publish === true && event.status !== EventStatus.PUBLISHED;

  return prisma.event.update({
    where: { id: eventId },
    data: {
      title: input.title?.trim() || undefined,
      description:
        input.description !== undefined
          ? input.description?.trim() || null
          : undefined,
      location:
        input.location !== undefined
          ? input.location?.trim() || null
          : undefined,
      date: input.date ? new Date(input.date) : undefined,
      coverImageUrl,
      coverImagePublicId,
      status: becomesPublished ? EventStatus.PUBLISHED : undefined,
      publishedAt: becomesPublished ? new Date() : undefined,
    },
  });
}

/**
 * Soft delete (SRS 11.7 — data retained for system records).
 */
export async function deleteEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.status === EventStatus.DELETED) {
    throw ApiError.notFound('Event not found.');
  }
  await prisma.event.update({
    where: { id: eventId },
    data: { status: EventStatus.DELETED, deletedAt: new Date() },
  });
  return { ok: true };
}

/**
 * Leader list — includes DRAFT events.
 */
export async function leaderListEvents() {
  return prisma.event.findMany({
    where: { status: { not: EventStatus.DELETED } },
    orderBy: { date: 'desc' },
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      status: true,
      coverImageUrl: true,
      publishedAt: true,
    },
  });
}

/**
 * Set or change own RSVP (SRS 11.5).
 * Rules:
 * - Only for PUBLISHED events.
 * - Closed within 24h of event start.
 * - One RSVP per user.
 */
export async function setRsvp(
  eventId: string,
  userId: string,
  response: RsvpResponse,
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.status !== EventStatus.PUBLISHED) {
    throw ApiError.notFound('Event not found.');
  }
  if (rsvpClosed(event.date)) {
    throw new ApiError(
      400,
      'RSVP_CLOSED',
      'RSVP is closed. Responses cannot be changed within 24 hours of the event.',
    );
  }

  return prisma.eventRSVP.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, response },
    update: { response },
  });
}

/**
 * Remove own RSVP.
 */
export async function clearRsvp(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.status !== EventStatus.PUBLISHED) {
    throw ApiError.notFound('Event not found.');
  }
  if (rsvpClosed(event.date)) {
    throw new ApiError(400, 'RSVP_CLOSED', 'RSVP is closed.');
  }
  await prisma.eventRSVP.deleteMany({ where: { eventId, userId } });
  return { ok: true };
}