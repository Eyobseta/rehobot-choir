import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import {
  Prisma,
  SongStatus,
  SubmissionStatus,
  NotificationType,
  UserRole,
} from '@prisma/client';
import { uploadBuffer, deleteByPublicId } from '../storage/cloudinary';
import { fanOut } from '../notifications/notifications.service';

// ---------- Categories ----------

export async function listCategories() {
  return prisma.songCategory.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

/**
 * Race-safe: relies on the DB's unique constraint on `SongCategory.name`.
 * A concurrent insert that loses the race surfaces as P2002 and is mapped
 * to a 409 instead of leaking a 500.
 */
export async function createCategory(name: string) {
  const clean = name.trim();
  if (!clean) throw ApiError.badRequest('Name is required.');

  try {
    return await prisma.songCategory.create({ data: { name: clean } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw ApiError.conflict('Category already exists.', 'CATEGORY_EXISTS');
    }
    throw e;
  }
}

/**
 * Race-safe rename. Handles:
 *   P2002 — another category took the name first   -> 409
 *   P2025 — the category was deleted concurrently  -> 404
 */
export async function renameCategory(id: string, name: string) {
  const clean = name.trim();
  if (!clean) throw ApiError.badRequest('Name is required.');

  try {
    return await prisma.songCategory.update({
      where: { id },
      data: { name: clean },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        throw ApiError.conflict('Category already exists.', 'CATEGORY_EXISTS');
      }
      if (e.code === 'P2025') {
        throw ApiError.notFound('Category not found.');
      }
    }
    throw e;
  }
}

/**
 * Race-safe delete. Handles:
 *   P2025 — the category was deleted concurrently  -> 404
 *
 * The Song.category relation is `onDelete: SetNull`, so deleting a category
 * does not fail even if songs still reference it — they just end up with
 * categoryId = null. The deleted songs' `category` field is removed by the
 * DB; no app-level cleanup needed.
 */
export async function deleteCategory(id: string) {
  try {
    await prisma.songCategory.delete({ where: { id } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2025'
    ) {
      throw ApiError.notFound('Category not found.');
    }
    throw e;
  }
  return { ok: true };
}

// ---------- Songs (member) ----------

export async function listPublishedSongs(search?: string) {
  const q = (search ?? '').trim();
  return prisma.song.findMany({
    where: {
      status: SongStatus.PUBLISHED,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { lyrics: { contains: q, mode: 'insensitive' } },
              { category: { is: { name: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      youtubeUrl: true,
      audioUrl: true,
      dateAdded: true,
      category: { select: { id: true, name: true } },
    },
  });
}

export async function getPublishedSong(id: string) {
  const song = await prisma.song.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!song || song.status !== SongStatus.PUBLISHED) {
    throw ApiError.notFound('Song not found.');
  }
  return song;
}

export async function favoriteSong(songId: string, userId: string) {
  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song || song.status !== SongStatus.PUBLISHED) {
    throw ApiError.notFound('Song not found.');
  }
  await prisma.songFavorite.upsert({
    where: { songId_userId: { songId, userId } },
    create: { songId, userId },
    update: {},
  });
  return { ok: true };
}

export async function unfavoriteSong(songId: string, userId: string) {
  await prisma.songFavorite.deleteMany({ where: { songId, userId } });
  return { ok: true };
}

export async function listMyFavorites(userId: string) {
  return prisma.songFavorite.findMany({
    where: { userId, song: { status: SongStatus.PUBLISHED } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      song: {
        select: {
          id: true,
          title: true,
          youtubeUrl: true,
          audioUrl: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });
}

// ---------- Songs (leader) ----------

export async function leaderListSongs() {
  return prisma.song.findMany({
    where: { status: { not: SongStatus.DELETED } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      title: true,
      status: true,
      dateAdded: true,
      publishedAt: true,
      category: { select: { id: true, name: true } },
    },
  });
}

export async function createSong(
  leaderUserId: string,
  input: {
    title: string;
    lyrics?: string;
    youtubeUrl?: string;
    categoryId?: string | null;
    audio?: { buffer: Buffer; mimetype: string } | null;
    publish?: boolean;
  },
) {
  if (!input.title?.trim()) throw ApiError.badRequest('Title is required.');

  let audioUrl: string | null = null;
  let audioPublicId: string | null = null;

  if (input.audio) {
    const uploaded = await uploadBuffer(
      input.audio.buffer,
      'rehobot/song-audio',
      `song_${Date.now()}`,
      'video',
    );
    audioUrl = uploaded.url;
    audioPublicId = uploaded.publicId;
  }

  const publish = Boolean(input.publish);

  const created = await prisma.song.create({
    data: {
      title: input.title.trim(),
      lyrics: input.lyrics?.trim() || null,
      youtubeUrl: input.youtubeUrl?.trim() || null,
      audioUrl,
      audioPublicId,
      categoryId: input.categoryId ?? null,
      status: publish ? SongStatus.PUBLISHED : SongStatus.DRAFT,
      publishedAt: publish ? new Date() : null,
      createdByUserId: leaderUserId,
    },
  });

  if (publish) {
    await fanOutNotification(created.id, created.title);
  }

  return created;
}

export async function updateSong(
  id: string,
  input: {
    title?: string;
    lyrics?: string | null;
    youtubeUrl?: string | null;
    categoryId?: string | null;
    audio?: { buffer: Buffer; mimetype: string } | null;
    removeAudio?: boolean;
    publish?: boolean;
    unpublish?: boolean;
  },
) {
  const song = await prisma.song.findUnique({ where: { id } });
  if (!song || song.status === SongStatus.DELETED) {
    throw ApiError.notFound('Song not found.');
  }

  let audioUrl = song.audioUrl;
  let audioPublicId = song.audioPublicId;

  if (input.audio) {
    const uploaded = await uploadBuffer(
      input.audio.buffer,
      'rehobot/song-audio',
      `song_${Date.now()}`,
      'video',
    );
    if (audioPublicId) await deleteByPublicId(audioPublicId, 'video');
    audioUrl = uploaded.url;
    audioPublicId = uploaded.publicId;
  } else if (input.removeAudio) {
    if (audioPublicId) await deleteByPublicId(audioPublicId, 'video');
    audioUrl = null;
    audioPublicId = null;
  }

  const wasPublished = song.status === SongStatus.PUBLISHED;
  const shouldPublish = input.publish === true;
  const shouldUnpublish = input.unpublish === true;

  let newStatus: SongStatus = song.status;
  if (shouldPublish) newStatus = SongStatus.PUBLISHED;
  else if (shouldUnpublish) newStatus = SongStatus.UNPUBLISHED;

  const updated = await prisma.song.update({
    where: { id },
    data: {
      title: input.title?.trim() || undefined,
      lyrics:
        input.lyrics !== undefined
          ? input.lyrics?.trim() || null
          : undefined,
      youtubeUrl:
        input.youtubeUrl !== undefined
          ? input.youtubeUrl?.trim() || null
          : undefined,
      categoryId:
        input.categoryId !== undefined ? input.categoryId : undefined,
      audioUrl,
      audioPublicId,
      status: newStatus,
      publishedAt:
        !wasPublished && newStatus === SongStatus.PUBLISHED
          ? new Date()
          : undefined,
    },
  });

  if (!wasPublished && newStatus === SongStatus.PUBLISHED) {
    await fanOutNotification(updated.id, updated.title);
  }

  return updated;
}

export async function deleteSong(id: string) {
  const song = await prisma.song.findUnique({ where: { id } });
  if (!song || song.status === SongStatus.DELETED) {
    throw ApiError.notFound('Song not found.');
  }
  await prisma.song.update({
    where: { id },
    data: { status: SongStatus.DELETED },
  });
  return { ok: true };
}

// ---------- Zema Team ----------

export async function listZemaMembers() {
  return prisma.zemaMembership.findMany({
    where: { removedAt: null },
    orderBy: { assignedAt: 'desc' },
    select: {
      id: true,
      assignedAt: true,
      user: {
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

export async function addZemaMember(leaderUserId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw ApiError.notFound('Member not found.');

  const existing = await prisma.zemaMembership.findFirst({
    where: { userId, removedAt: null },
  });
  if (existing) {
    throw ApiError.conflict('Already a Zema member.', 'ALREADY_ZEMA');
  }

  await prisma.zemaMembership.create({
    data: { userId, assignedByUserId: leaderUserId },
  });
  return { ok: true };
}

export async function removeZemaMember(userId: string) {
  const active = await prisma.zemaMembership.findFirst({
    where: { userId, removedAt: null },
  });
  if (!active) throw ApiError.notFound('Not a Zema member.');
  await prisma.zemaMembership.update({
    where: { id: active.id },
    data: { removedAt: new Date() },
  });
  return { ok: true };
}

export async function isZemaMember(userId: string): Promise<boolean> {
  const m = await prisma.zemaMembership.findFirst({
    where: { userId, removedAt: null },
  });
  return Boolean(m);
}

// ---------- Zema submissions ----------

export async function listMySubmissions(userId: string) {
  return prisma.songSubmission.findMany({
    where: { submittedByUserId: userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      song: {
        select: {
          id: true,
          title: true,
          youtubeUrl: true,
          audioUrl: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function saveSubmissionDraft(
  userId: string,
  input: {
    submissionId?: string | null;
    title: string;
    lyrics?: string;
    youtubeUrl?: string;
    categoryId?: string | null;
    audio?: { buffer: Buffer; mimetype: string } | null;
  },
) {
  if (!input.title?.trim()) throw ApiError.badRequest('Title is required.');

  if (input.submissionId) {
    const existing = await prisma.songSubmission.findUnique({
      where: { id: input.submissionId },
      include: { song: true },
    });
    if (!existing || existing.submittedByUserId !== userId) {
      throw ApiError.notFound('Submission not found.');
    }
    if (
      existing.status === SubmissionStatus.PENDING_REVIEW ||
      existing.status === SubmissionStatus.APPROVED
    ) {
      throw ApiError.conflict('Cannot edit while in review or approved.');
    }

    let audioUrl = existing.song.audioUrl;
    let audioPublicId = existing.song.audioPublicId;
    if (input.audio) {
      const uploaded = await uploadBuffer(
        input.audio.buffer,
        'rehobot/song-audio',
        `song_${Date.now()}`,
        'video',
      );
      if (audioPublicId) await deleteByPublicId(audioPublicId, 'video');
      audioUrl = uploaded.url;
      audioPublicId = uploaded.publicId;
    }

    await prisma.song.update({
      where: { id: existing.songId },
      data: {
        title: input.title.trim(),
        lyrics: input.lyrics?.trim() || null,
        youtubeUrl: input.youtubeUrl?.trim() || null,
        categoryId: input.categoryId ?? null,
        audioUrl,
        audioPublicId,
        status: SongStatus.DRAFT,
      },
    });
    await prisma.songSubmission.update({
      where: { id: input.submissionId },
      data: { status: SubmissionStatus.DRAFT },
    });
    return { ok: true, submissionId: input.submissionId };
  }

  let audioUrl: string | null = null;
  let audioPublicId: string | null = null;
  if (input.audio) {
    const uploaded = await uploadBuffer(
      input.audio.buffer,
      'rehobot/song-audio',
      `song_${Date.now()}`,
      'video',
    );
    audioUrl = uploaded.url;
    audioPublicId = uploaded.publicId;
  }

  const song = await prisma.song.create({
    data: {
      title: input.title.trim(),
      lyrics: input.lyrics?.trim() || null,
      youtubeUrl: input.youtubeUrl?.trim() || null,
      categoryId: input.categoryId ?? null,
      audioUrl,
      audioPublicId,
      status: SongStatus.DRAFT,
      createdByUserId: userId,
    },
  });

  const submission = await prisma.songSubmission.create({
    data: {
      songId: song.id,
      submittedByUserId: userId,
      status: SubmissionStatus.DRAFT,
    },
  });

  return { ok: true, submissionId: submission.id };
}

export async function submitForReview(userId: string, submissionId: string) {
  const sub = await prisma.songSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!sub || sub.submittedByUserId !== userId) {
    throw ApiError.notFound('Submission not found.');
  }
  if (
    sub.status === SubmissionStatus.PENDING_REVIEW ||
    sub.status === SubmissionStatus.APPROVED
  ) {
    throw ApiError.conflict('Already submitted.');
  }

  // Clear old returnReason on resubmission (SRS 13.6 — not retained).
  await prisma.$transaction([
    prisma.songSubmission.update({
      where: { id: submissionId },
      data: { status: SubmissionStatus.PENDING_REVIEW, returnReason: null },
    }),
    prisma.song.update({
      where: { id: sub.songId },
      data: { status: SongStatus.PENDING_REVIEW },
    }),
  ]);

  return { ok: true };
}

// ---------- Leader review queue ----------

export async function listPendingSubmissions() {
  return prisma.songSubmission.findMany({
    where: { status: SubmissionStatus.PENDING_REVIEW },
    orderBy: { updatedAt: 'asc' },
    include: {
      song: {
        select: {
          id: true,
          title: true,
          lyrics: true,
          youtubeUrl: true,
          audioUrl: true,
          category: { select: { id: true, name: true } },
        },
      },
      submittedBy: {
        select: {
          id: true,
          memberProfile: { select: { fullName: true, profilePhotoUrl: true } },
        },
      },
    },
  });
}

export async function approveSubmission(submissionId: string) {
  const sub = await prisma.songSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!sub || sub.status !== SubmissionStatus.PENDING_REVIEW) {
    throw ApiError.notFound('Submission not found or not pending.');
  }
  await prisma.$transaction([
    prisma.songSubmission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED,
        reviewedAt: new Date(),
        returnReason: null,
      },
    }),
    prisma.song.update({
      where: { id: sub.songId },
      data: {
        status: SongStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    }),
  ]);

  const song = await prisma.song.findUnique({ where: { id: sub.songId } });
  if (song) {
    await fanOutNotification(song.id, song.title);
  }

  return { ok: true };
}

export async function returnSubmission(submissionId: string, reason: string) {
  const clean = reason.trim();
  if (!clean) {
    throw ApiError.badRequest('Return reason is required.');
  }
  const sub = await prisma.songSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!sub || sub.status !== SubmissionStatus.PENDING_REVIEW) {
    throw ApiError.notFound('Submission not found or not pending.');
  }
  await prisma.$transaction([
    prisma.songSubmission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.RETURNED,
        returnReason: clean,
        reviewedAt: new Date(),
      },
    }),
    prisma.song.update({
      where: { id: sub.songId },
      data: { status: SongStatus.RETURNED },
    }),
  ]);
  return { ok: true };
}

// ---------- Notification fan-out ----------

async function fanOutNotification(songId: string, title: string) {
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
    type: 'SONG_PUBLISHED',
    title: `New song: ${title}`,
    relatedEntityType: 'Song',
    relatedEntityId: songId,
  });
}

/**
 * Leader-side fetch — returns a song in ANY status except DELETED.
 * Used by the leader editor and the review queue detail view.
 */
export async function leaderGetSongById(id: string) {
  const song = await prisma.song.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!song || song.status === SongStatus.DELETED) {
    throw ApiError.notFound('Song not found.');
  }
  return song;
}