import { apiGet, apiPost, apiDelete } from './api';
import { cachedFetch, cacheInvalidatePrefix } from './cache';
import { CACHE_KEYS, CACHE_PREFIXES } from './cacheKeys';

export type BirthdayReaction = {
  emoji: string;
  count: number;
};

export type BirthdayComment = {
  id: string;
  text: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    profilePhotoUrl: string | null;
  };
  likeCount: number;
  likedByMe: boolean;
  replies: BirthdayCommentReply[];
};

export type BirthdayCommentReply = {
  id: string;
  text: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    profilePhotoUrl: string | null;
  };
  likeCount: number;
  likedByMe: boolean;
};

export type BirthdayPostDetail = {
  id: string;
  year: number;
  birthdayDate: string;
  person: {
    id: string;
    fullName: string;
    profilePhotoUrl: string | null;
    phone: string;
    gender: string | null;
    dateOfBirth: string | null;
    joiningDate: string | null;
  };
  reactions: BirthdayReaction[];
  myReaction: string | null;
  comments: BirthdayComment[];
};

export type BirthdayPerson = {
  userId: string;
  fullName: string;
  profilePhotoUrl: string | null;
  postId: string;
};

export type BirthdaysResponse = {
  today: BirthdayPerson[];
  tomorrow: BirthdayPerson[];
};

export const ALLOWED_REACTIONS = [
  '❤️',
  '🎉',
  '🎂',
  '🙏',
  '😍',
  '👏',
  '🥳',
  '✨',
] as const;

// ---------- Cached reads ----------

export async function listBirthdays(): Promise<BirthdaysResponse> {
  const cached = await cachedFetch<BirthdaysResponse>(
    CACHE_KEYS.birthdays,
    async () => {
      return apiGet<BirthdaysResponse>('/members/birthdays');
    },
    () => {},
  );
  return cached ?? { today: [], tomorrow: [] };
}

export async function getBirthdayPost(id: string): Promise<BirthdayPostDetail> {
  const key = `${CACHE_PREFIXES.birthday}post:${id}`;
  const cached = await cachedFetch<BirthdayPostDetail>(
    key,
    async () => {
      const res = await apiGet<{ post: BirthdayPostDetail }>(
        `/birthdays/posts/${id}`,
      );
      return res.post;
    },
    () => {},
  );
  if (cached) return cached;
  const res = await apiGet<{ post: BirthdayPostDetail }>(
    `/birthdays/posts/${id}`,
  );
  return res.post;
}

// ---------- Mutations (invalidate birthday caches) ----------

export async function setBirthdayReaction(
  postId: string,
  emoji: string,
): Promise<void> {
  await apiPost(`/birthdays/posts/${postId}/reaction`, { emoji });
  await cacheInvalidatePrefix(CACHE_PREFIXES.birthday);
}

export async function removeBirthdayReaction(postId: string): Promise<void> {
  await apiDelete(`/birthdays/posts/${postId}/reaction`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.birthday);
}

export async function addBirthdayComment(
  postId: string,
  text: string,
  parentCommentId?: string | null,
): Promise<{ id: string }> {
  const res = await apiPost<{ id: string }>(
    `/birthdays/posts/${postId}/comments`,
    {
      text,
      parentCommentId: parentCommentId ?? null,
    },
  );
  await cacheInvalidatePrefix(CACHE_PREFIXES.birthday);
  return res;
}

export async function deleteBirthdayComment(id: string): Promise<void> {
  await apiDelete(`/birthdays/comments/${id}`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.birthday);
}

export async function likeBirthdayComment(id: string): Promise<void> {
  await apiPost(`/birthdays/comments/${id}/like`, {});
  await cacheInvalidatePrefix(CACHE_PREFIXES.birthday);
}

export async function unlikeBirthdayComment(id: string): Promise<void> {
  await apiDelete(`/birthdays/comments/${id}/like`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.birthday);
}