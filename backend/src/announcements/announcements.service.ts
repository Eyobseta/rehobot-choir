import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import {
  AnnouncementStatus,
  UserRole,
} from '@prisma/client';
import { uploadBuffer, deleteByPublicId } from '../storage/cloudinary';
import { fanOut } from '../notifications/notifications.service';

/**
 * Announcements visible to members:
 * - status PUBLISHED
 * - publishAt <= now
 * - not deleted
 */
export async function listPublishedAnnouncements(search?: string) {
  const q = (search ?? '').trim();
  const now = new Date();

  return prisma.announcement.findMany({
    where: {
      status: AnnouncementStatus.PUBLISHED,
      deletedAt: null,
      publishAt: { lte: now },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { message: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { publishAt: 'desc' },
    take: 60,
    select: {
      id: true,
      title: true,
      message: true,
      publishAt: true,
      imageUrl: true,
      eventId: true,
    },
  });
}

export async function getAnnouncementDetail(id: string) {
  const ann = await prisma.announcement.findUnique({
    where: { id },
    include: {
      songs: { select: { id: true, songId: true, songTitle: true } },
      event: { select: { id: true, title: true, date: true } },
    },
  });
  if (!ann || ann.status !== AnnouncementStatus.PUBLISHED || ann.deletedAt) {
    throw ApiError.notFound('Announcement not found.');
  }
  return ann;
}

export async function leaderListAnnouncements() {
  return prisma.announcement.findMany({
    where: { status: { not: AnnouncementStatus.DELETED } },
    orderBy: { publishAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      publishAt: true,
      imageUrl: true,
      eventId: true,
    },
  });
}

export async function createAnnouncement(
  leaderUserId: string,
  input: {
    title: string;
    message: string;
    publishAt?: string;
    eventId?: string | null;
    songIds?: { songId: string; songTitle: string }[];
    image?: { buffer: Buffer; mimetype: string } | null;
    publish?: boolean;
  },
) {
  if (!input.title?.trim()) throw ApiError.badRequest('Title is required.');
  if (!input.message?.trim()) throw ApiError.badRequest('Message is required.');

  const publishAt = input.publishAt ? new Date(input.publishAt) : new Date();
  if (Number.isNaN(publishAt.getTime())) {
    throw ApiError.badRequest('Invalid publishAt.');
  }

  if (input.eventId) {
    const ev = await prisma.event.findUnique({ where: { id: input.eventId } });
    if (!ev) throw ApiError.badRequest('Linked event not found.');
  }

  let imageUrl: string | null = null;
  let imagePublicId: string | null = null;
  if (input.image) {
    const uploaded = await uploadBuffer(
      input.image.buffer,
      'rehobot/announcement-images',
      `ann_${Date.now()}`,
    );
    imageUrl = uploaded.url;
    imagePublicId = uploaded.publicId;
  }

  const now = new Date();
  const shouldPublish =
    input.publish === true && publishAt.getTime() <= now.getTime();

  const status: AnnouncementStatus = shouldPublish
    ? AnnouncementStatus.PUBLISHED
    : publishAt.getTime() > now.getTime()
    ? AnnouncementStatus.SCHEDULED
    : AnnouncementStatus.DRAFT;

  const created = await prisma.announcement.create({
    data: {
      title: input.title.trim(),
      message: input.message.trim(),
      publishAt,
      status,
      imageUrl,
      imagePublicId,
      eventId: input.eventId ?? null,
      createdByUserId: leaderUserId,
      songs:
        input.songIds && input.songIds.length > 0
          ? {
              create: input.songIds.map((s) => ({
                songId: s.songId,
                songTitle: s.songTitle,
              })),
            }
          : undefined,
    },
  });

  if (status === AnnouncementStatus.PUBLISHED) {
    await fanOutNotification(created.id, created.title, created.message);
  }

  return created;
}

export async function updateAnnouncement(
  id: string,
  input: {
    title?: string;
    message?: string;
    publishAt?: string;
    eventId?: string | null;
    songIds?: { songId: string; songTitle: string }[];
    image?: { buffer: Buffer; mimetype: string } | null;
    removeImage?: boolean;
    publish?: boolean;
  },
) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann || ann.status === AnnouncementStatus.DELETED) {
    throw ApiError.notFound('Announcement not found.');
  }

  let imageUrl = ann.imageUrl;
  let imagePublicId = ann.imagePublicId;

  if (input.image) {
    const uploaded = await uploadBuffer(
      input.image.buffer,
      'rehobot/announcement-images',
      `ann_${Date.now()}`,
    );
    if (imagePublicId) await deleteByPublicId(imagePublicId);
    imageUrl = uploaded.url;
    imagePublicId = uploaded.publicId;
  } else if (input.removeImage) {
    if (imagePublicId) await deleteByPublicId(imagePublicId);
    imageUrl = null;
    imagePublicId = null;
  }

  const publishAt = input.publishAt ? new Date(input.publishAt) : ann.publishAt;
  if (Number.isNaN(publishAt.getTime())) {
    throw ApiError.badRequest('Invalid publishAt.');
  }

  const now = new Date();
  const shouldPublish =
    input.publish === true && publishAt.getTime() <= now.getTime();

  const wasPublished = ann.status === AnnouncementStatus.PUBLISHED;
  const newStatus: AnnouncementStatus = shouldPublish
    ? AnnouncementStatus.PUBLISHED
    : publishAt.getTime() > now.getTime()
    ? AnnouncementStatus.SCHEDULED
    : ann.status === AnnouncementStatus.PUBLISHED
    ? AnnouncementStatus.PUBLISHED
    : AnnouncementStatus.DRAFT;

  if (input.songIds) {
    await prisma.announcementSong.deleteMany({
      where: { announcementId: id },
    });
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: {
      title: input.title?.trim() || undefined,
      message: input.message?.trim() || undefined,
      publishAt,
      status: newStatus,
      imageUrl,
      imagePublicId,
      eventId: input.eventId !== undefined ? input.eventId : undefined,
      songs: input.songIds
        ? {
            create: input.songIds.map((s) => ({
              songId: s.songId,
              songTitle: s.songTitle,
            })),
          }
        : undefined,
    },
  });

  if (!wasPublished && newStatus === AnnouncementStatus.PUBLISHED) {
    await fanOutNotification(updated.id, updated.title, updated.message);
  }

  return updated;
}

export async function deleteAnnouncement(id: string) {
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann || ann.status === AnnouncementStatus.DELETED) {
    throw ApiError.notFound('Announcement not found.');
  }
  await prisma.announcement.update({
    where: { id },
    data: { status: AnnouncementStatus.DELETED, deletedAt: new Date() },
  });
  return { ok: true };
}

/**
 * Fire in-app Notifications + push for every approved member.
 */
async function fanOutNotification(
  announcementId: string,
  title: string,
  message: string,
) {
  const recipients = await prisma.user.findMany({
    where: {
      status: 'APPROVED',
      deletedAt: null,
      role: { in: [UserRole.MEMBER, UserRole.LEADER] },
    },
    select: { id: true },
  });

  await fanOut({
    recipients: recipients.map((r) => r.id),
    type: 'ANNOUNCEMENT',
    title,
    body: message,
    relatedEntityType: 'Announcement',
    relatedEntityId: announcementId,
  });
}