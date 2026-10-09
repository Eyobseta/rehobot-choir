import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';

// Allowed reactions (a curated set so we do not store arbitrary strings).
const ALLOWED_EMOJIS = new Set([
  '❤️',
  '🎉',
  '🎂',
  '🙏',
  '😍',
  '👏',
  '🥳',
  '✨',
]);

// ---------- Post detail ----------

export async function getBirthdayPostDetail(postId: string, viewerId: string) {
  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  if (!viewer || viewer.deletedAt || viewer.status !== 'APPROVED') {
    throw ApiError.forbidden('Only approved members can view birthday posts.');
  }

  const post = await prisma.birthdayPost.findUnique({
    where: { id: postId },
    include: {
      user: {
        select: {
          id: true,
          phone: true,
          memberProfile: {
            select: {
              fullName: true,
              profilePhotoUrl: true,
              gender: true,
              dateOfBirth: true,
              joiningDate: true,
            },
          },
        },
      },
      reactions: {
        select: {
          id: true,
          userId: true,
          emoji: true,
        },
      },
      comments: {
        where: { parentCommentId: null, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              memberProfile: {
                select: { fullName: true, profilePhotoUrl: true },
              },
            },
          },
          likes: {
            select: { userId: true },
          },
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              author: {
                select: {
                  id: true,
                  memberProfile: {
                    select: { fullName: true, profilePhotoUrl: true },
                  },
                },
              },
              likes: {
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!post) throw ApiError.notFound('Birthday post not found.');

  const myReaction =
    post.reactions.find((r) => r.userId === viewerId)?.emoji ?? null;

  // Reaction summary: count per emoji.
  const reactionCounts = new Map<string, number>();
  for (const r of post.reactions) {
    reactionCounts.set(r.emoji, (reactionCounts.get(r.emoji) ?? 0) + 1);
  }
  const reactions = Array.from(reactionCounts.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);

  // Shape comments.
  const comments = post.comments.map((c) => ({
    id: c.id,
    text: c.text,
    createdAt: c.createdAt,
    author: {
      id: c.author.id,
      fullName: c.author.memberProfile?.fullName ?? 'Member',
      profilePhotoUrl: c.author.memberProfile?.profilePhotoUrl ?? null,
    },
    likeCount: c.likes.length,
    likedByMe: c.likes.some((l) => l.userId === viewerId),
    replies: c.replies.map((r) => ({
      id: r.id,
      text: r.text,
      createdAt: r.createdAt,
      author: {
        id: r.author.id,
        fullName: r.author.memberProfile?.fullName ?? 'Member',
        profilePhotoUrl: r.author.memberProfile?.profilePhotoUrl ?? null,
      },
      likeCount: r.likes.length,
      likedByMe: r.likes.some((l) => l.userId === viewerId),
    })),
  }));

  const birthday = post.user.memberProfile;

  return {
    id: post.id,
    year: post.year,
    birthdayDate: post.birthdayDate,
    person: {
      id: post.user.id,
      fullName: birthday?.fullName ?? 'Member',
      profilePhotoUrl: birthday?.profilePhotoUrl ?? null,
      phone: post.user.phone,
      gender: birthday?.gender ?? null,
      dateOfBirth: birthday?.dateOfBirth ?? null,
      joiningDate: birthday?.joiningDate ?? null,
    },
    reactions,
    myReaction,
    comments,
  };
}

// ---------- Reactions ----------

export async function setReaction(
  postId: string,
  userId: string,
  emoji: string,
) {
  if (!ALLOWED_EMOJIS.has(emoji)) {
    throw ApiError.badRequest('Unsupported reaction.');
  }

  const post = await prisma.birthdayPost.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound('Birthday post not found.');

  await prisma.birthdayReaction.upsert({
    where: { postId_userId: { postId, userId } },
    create: { postId, userId, emoji },
    update: { emoji },
  });
  return { ok: true };
}

export async function removeReaction(postId: string, userId: string) {
  await prisma.birthdayReaction.deleteMany({ where: { postId, userId } });
  return { ok: true };
}

// ---------- Comments ----------

export async function addComment(
  postId: string,
  userId: string,
  text: string,
  parentCommentId?: string | null,
) {
  const clean = text.trim();
  if (!clean) throw ApiError.badRequest('Comment cannot be empty.');
  if (clean.length > 2000) {
    throw ApiError.badRequest('Comment is too long.');
  }

  const post = await prisma.birthdayPost.findUnique({ where: { id: postId } });
  if (!post) throw ApiError.notFound('Birthday post not found.');

  if (parentCommentId) {
    const parent = await prisma.birthdayComment.findUnique({
      where: { id: parentCommentId },
    });
    if (!parent || parent.postId !== postId || parent.deletedAt) {
      throw ApiError.badRequest('Parent comment not found.');
    }
    // Only one level of nesting is allowed.
    if (parent.parentCommentId) {
      throw ApiError.badRequest('Cannot reply to a reply.');
    }
  }

  const created = await prisma.birthdayComment.create({
    data: {
      postId,
      authorId: userId,
      text: clean,
      parentCommentId: parentCommentId ?? null,
    },
  });

  return { id: created.id };
}

export async function deleteComment(
  commentId: string,
  userId: string,
  isLeader: boolean,
) {
  const comment = await prisma.birthdayComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.deletedAt) {
    throw ApiError.notFound('Comment not found.');
  }

  if (!isLeader && comment.authorId !== userId) {
    throw ApiError.forbidden('You can only delete your own comments.');
  }

  await prisma.birthdayComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  return { ok: true };
}

// ---------- Comment likes ----------

export async function likeComment(commentId: string, userId: string) {
  const comment = await prisma.birthdayComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.deletedAt) {
    throw ApiError.notFound('Comment not found.');
  }

  await prisma.birthdayCommentLike.upsert({
    where: { commentId_userId: { commentId, userId } },
    create: { commentId, userId },
    update: {},
  });
  return { ok: true };
}

export async function unlikeComment(commentId: string, userId: string) {
  await prisma.birthdayCommentLike.deleteMany({
    where: { commentId, userId },
  });
  return { ok: true };
}