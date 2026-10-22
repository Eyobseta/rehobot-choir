import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import {
  MemoryMediaType,
  MemoryStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { uploadBuffer, deleteByPublicId } from '../storage/cloudinary';
import { fanOut } from '../notifications/notifications.service';

// ---------- Member ----------

export async function listPublishedMemories(search?: string) {
  const q = (search ?? '').trim();

  const where: any = {
    status: MemoryStatus.PUBLISHED,
    deletedAt: null,
  };

  if (q) {
    const parsed = Date.parse(q);
    const looksLikeDate = /^\d{4}(-\d{2})?(-\d{2})?$/.test(q);

    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      ...(looksLikeDate && !Number.isNaN(parsed)
        ? [{ date: { gte: new Date(`${q.slice(0, 7)}-01T00:00:00.000Z`) } }]
        : []),
    ];
  }

  return prisma.memory.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      date: true,
      media: {
        select: { id: true, type: true, storageUrl: true },
        take: 1,
      },
    },
  });
}

export async function listMemoryYears() {
  const rows = await prisma.memory.findMany({
    where: { status: MemoryStatus.PUBLISHED, deletedAt: null },
    select: { date: true },
  });

  const byYear = new Map<number, number>();
  for (const r of rows) {
    const y = r.date.getUTCFullYear();
    byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }

  return Array.from(byYear.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);
}

export async function getPublishedMemory(id: string) {
  const m = await prisma.memory.findUnique({
    where: { id },
    include: {
      media: {
        select: {
          id: true,
          type: true,
          storageUrl: true,
          youtubeUrl: true,
        },
      },
    },
  });
  if (!m || m.status !== MemoryStatus.PUBLISHED || m.deletedAt) {
    throw ApiError.notFound('Memory not found.');
  }
  return m;
}

/**
 * Returns a memory regardless of status, but ONLY if it belongs to the
 * requesting user. Used by the "My submissions" detail view so members can
 * see their own pending / rejected items.
 */
export async function getMyMemory(userId: string, id: string) {
  const m = await prisma.memory.findUnique({
    where: { id },
    include: {
      media: {
        select: {
          id: true,
          type: true,
          storageUrl: true,
          youtubeUrl: true,
        },
      },
    },
  });

  if (!m || m.deletedAt) throw ApiError.notFound('Memory not found.');

  if (m.submittedByUserId !== userId) {
    throw ApiError.forbidden('This memory does not belong to you.');
  }

  return m;
}

// ---------- Member submission ----------

export type MemorySubmissionInput = {
  title: string;
  description?: string;
  date: string;
  photos?: { buffer: Buffer; mimetype: string }[];
  audio?: { buffer: Buffer; mimetype: string } | null;
  youtubeUrls?: string[];
};

export async function submitMemory(
  userId: string,
  input: MemorySubmissionInput,
) {
  if (!input.title?.trim()) throw ApiError.badRequest('Title is required.');
  if (!input.date || Number.isNaN(new Date(input.date).getTime())) {
    throw ApiError.badRequest('A valid date is required.');
  }

  const media: {
    type: MemoryMediaType;
    storageUrl?: string;
    storagePublicId?: string;
    youtubeUrl?: string;
  }[] = [];

  if (input.photos && input.photos.length > 0) {
    for (const p of input.photos) {
      const uploaded = await uploadBuffer(
        p.buffer,
        'rehobot/memory-photos',
        `mem_${Date.now()}`,
        'image',
      );
      media.push({
        type: MemoryMediaType.PHOTO,
        storageUrl: uploaded.url,
        storagePublicId: uploaded.publicId,
      });
    }
  }

  if (input.audio) {
    const uploaded = await uploadBuffer(
      input.audio.buffer,
      'rehobot/memory-audio',
      `mema_${Date.now()}`,
      'video',
    );
    media.push({
      type: MemoryMediaType.AUDIO,
      storageUrl: uploaded.url,
      storagePublicId: uploaded.publicId,
    });
  }

  if (input.youtubeUrls && input.youtubeUrls.length > 0) {
    for (const url of input.youtubeUrls) {
      if (url?.trim()) {
        media.push({
          type: MemoryMediaType.YOUTUBE,
          youtubeUrl: url.trim(),
        });
      }
    }
  }

  return prisma.memory.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      date: new Date(input.date),
      status: MemoryStatus.PENDING_REVIEW,
      submittedByUserId: userId,
      media:
        media.length > 0
          ? {
              create: media,
            }
          : undefined,
    },
  });
}

export async function listMyMemories(userId: string) {
  return prisma.memory.findMany({
    where: { submittedByUserId: userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      date: true,
      status: true,
      rejectionReason: true,
      reviewedAt: true,
      createdAt: true,
    },
  });
}

// ---------- Leader ----------

export async function leaderListPendingMemories() {
  return prisma.memory.findMany({
    where: { status: MemoryStatus.PENDING_REVIEW, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      media: {
        select: {
          id: true,
          type: true,
          storageUrl: true,
          youtubeUrl: true,
        },
      },
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

export async function leaderGetMemory(id: string) {
  const m = await prisma.memory.findUnique({
    where: { id },
    include: {
      media: {
        select: {
          id: true,
          type: true,
          storageUrl: true,
          youtubeUrl: true,
        },
      },
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
  if (!m || m.deletedAt) throw ApiError.notFound('Memory not found.');
  return m;
}

export async function approveMemory(id: string, leaderUserId: string) {
  const m = await prisma.memory.findUnique({ where: { id } });
  if (!m || m.deletedAt) throw ApiError.notFound('Memory not found.');
  if (m.status === MemoryStatus.PUBLISHED) {
    throw ApiError.conflict('Memory is already published.');
  }

  const updated = await prisma.memory.update({
    where: { id },
    data: {
      status: MemoryStatus.PUBLISHED,
      publishedAt: new Date(),
      rejectionReason: null,
      reviewedByUserId: leaderUserId,
      reviewedAt: new Date(),
    },
  });

  await fanOutNotification(
    updated.id,
    updated.title,
    NotificationType.MEMORY_PUBLISHED,
    'New memory',
  );

  return updated;
}

export async function rejectMemory(
  id: string,
  leaderUserId: string,
  reason?: string,
) {
  const m = await prisma.memory.findUnique({ where: { id } });
  if (!m || m.deletedAt) throw ApiError.notFound('Memory not found.');

  return prisma.memory.update({
    where: { id },
    data: {
      status: MemoryStatus.REJECTED,
      rejectionReason: reason?.trim() || null,
      reviewedByUserId: leaderUserId,
      reviewedAt: new Date(),
    },
  });
}

export type MemoryEditInput = {
  title?: string;
  description?: string | null;
  date?: string;
  replaceMedia?: {
    photos?: { buffer: Buffer; mimetype: string }[];
    audio?: { buffer: Buffer; mimetype: string } | null;
    youtubeUrls?: string[];
  };
};

export async function editMemory(
  id: string,
  leaderUserId: string,
  input: MemoryEditInput,
) {
  const m = await prisma.memory.findUnique({
    where: { id },
    include: { media: true },
  });
  if (!m || m.deletedAt) throw ApiError.notFound('Memory not found.');

  const wasPublished = m.status === MemoryStatus.PUBLISHED;

  await prisma.$transaction(async (tx) => {
    if (input.replaceMedia) {
      await tx.memoryMedia.deleteMany({ where: { memoryId: id } });

      const created: {
        type: MemoryMediaType;
        storageUrl?: string;
        storagePublicId?: string;
        youtubeUrl?: string;
      }[] = [];

      for (const p of input.replaceMedia.photos ?? []) {
        const uploaded = await uploadBuffer(
          p.buffer,
          'rehobot/memory-photos',
          `mem_${Date.now()}`,
          'image',
        );
        created.push({
          type: MemoryMediaType.PHOTO,
          storageUrl: uploaded.url,
          storagePublicId: uploaded.publicId,
        });
      }
      if (input.replaceMedia.audio) {
        const uploaded = await uploadBuffer(
          input.replaceMedia.audio.buffer,
          'rehobot/memory-audio',
          `mema_${Date.now()}`,
          'video',
        );
        created.push({
          type: MemoryMediaType.AUDIO,
          storageUrl: uploaded.url,
          storagePublicId: uploaded.publicId,
        });
      }
      for (const url of input.replaceMedia.youtubeUrls ?? []) {
        if (url?.trim()) {
          created.push({
            type: MemoryMediaType.YOUTUBE,
            youtubeUrl: url.trim(),
          });
        }
      }

      if (created.length > 0) {
        await tx.memoryMedia.createMany({
          data: created.map((c) => ({
            memoryId: id,
            type: c.type,
            storageUrl: c.storageUrl ?? null,
            storagePublicId: c.storagePublicId ?? null,
            youtubeUrl: c.youtubeUrl ?? null,
          })),
        });
      }
    }

    await tx.memory.update({
      where: { id },
      data: {
        title: input.title?.trim() || undefined,
        description:
          input.description !== undefined
            ? input.description?.trim() || null
            : undefined,
        date: input.date ? new Date(input.date) : undefined,
        reviewedByUserId: leaderUserId,
        reviewedAt: new Date(),
      },
    });
  });

  if (wasPublished) {
    await fanOutNotification(
      id,
      input.title?.trim() || m.title,
      NotificationType.MEMORY_PUBLISHED,
      'Memory updated',
    );
  }

  return { ok: true };
}

export async function deleteMemory(id: string) {
  const m = await prisma.memory.findUnique({ where: { id } });
  if (!m || m.deletedAt) throw ApiError.notFound('Memory not found.');
  await prisma.memory.update({
    where: { id },
    data: { status: MemoryStatus.DELETED, deletedAt: new Date() },
  });
  return { ok: true };
}

// ---------- Notification fan-out ----------

async function fanOutNotification(
  memoryId: string,
  title: string,
  _type: NotificationType,
  prefix: string,
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
    type: 'MEMORY_PUBLISHED',
    title: `${prefix}: ${title}`,
    relatedEntityType: 'Memory',
    relatedEntityId: memoryId,
  });
}