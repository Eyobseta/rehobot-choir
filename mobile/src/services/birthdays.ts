import { apiGet, apiPost, apiDelete } from './api';
import { queryClient } from './queryClient';
import type { EthDate } from '../utils/ethiopianCalendar';

// ... (keep all the type definitions: BirthdayReaction, BirthdayComment, BirthdayPostDetail, BirthdayPerson, BirthdaysResponse, ALLOWED_REACTIONS) ...

export type BirthdayReaction = { emoji: string; count: number };
export type BirthdayCommentReply = { id: string; text: string; createdAt: string; author: { id: string; fullName: string; profilePhotoUrl: string | null }; likeCount: number; likedByMe: boolean };
export type BirthdayComment = { id: string; text: string; createdAt: string; author: { id: string; fullName: string; profilePhotoUrl: string | null }; likeCount: number; likedByMe: boolean; replies: BirthdayCommentReply[] };
export type BirthdayPostDetail = { id: string; year: number; birthdayDate: EthDate; person: { id: string; fullName: string; profilePhotoUrl: string | null; phone: string; gender: string | null; dateOfBirth: EthDate | null; joiningDate: EthDate | null; }; reactions: BirthdayReaction[]; myReaction: string | null; comments: BirthdayComment[]; };
export type BirthdayPerson = { userId: string; fullName: string; profilePhotoUrl: string | null; postId: string; };
export type BirthdaysResponse = { today: BirthdayPerson[]; tomorrow: BirthdayPerson[]; };
export const ALLOWED_REACTIONS = ['❤️', '🎉', '🎂', '🙏', '😍', '👏', '🥳', '✨'] as const;

// ---------- Reads ----------

export async function listBirthdays(): Promise<BirthdaysResponse> {
  return apiGet<BirthdaysResponse>('/members/birthdays');
}

export async function getBirthdayPost(id: string): Promise<BirthdayPostDetail> {
  const res = await apiGet<{ post: BirthdayPostDetail }>(`/birthdays/posts/${id}`);
  return res.post;
}

// ---------- Mutations (invalidate via TanStack) ----------

function invalidateBirthdays(userId: string | null): Promise<void> {
  return queryClient
    .invalidateQueries({ queryKey: ['birthdays', userId ?? 'anon'] })
    .then(() => undefined);
}

export async function setBirthdayReaction(postId: string, emoji: string, userId: string | null): Promise<void> {
  await apiPost(`/birthdays/posts/${postId}/reaction`, { emoji });
  await invalidateBirthdays(userId);
}

export async function removeBirthdayReaction(postId: string, userId: string | null): Promise<void> {
  await apiDelete(`/birthdays/posts/${postId}/reaction`);
  await invalidateBirthdays(userId);
}

export async function addBirthdayComment(postId: string, text: string, parentCommentId: string | null | undefined, userId: string | null): Promise<{ id: string }> {
  const res = await apiPost<{ id: string }>(`/birthdays/posts/${postId}/comments`, { text, parentCommentId: parentCommentId ?? null });
  await invalidateBirthdays(userId);
  return res;
}

export async function deleteBirthdayComment(id: string, userId: string | null): Promise<void> {
  await apiDelete(`/birthdays/comments/${id}`);
  await invalidateBirthdays(userId);
}

export async function likeBirthdayComment(id: string, userId: string | null): Promise<void> {
  await apiPost(`/birthdays/comments/${id}/like`, {});
  await invalidateBirthdays(userId);
}

export async function unlikeBirthdayComment(id: string, userId: string | null): Promise<void> {
  await apiDelete(`/birthdays/comments/${id}/like`);
  await invalidateBirthdays(userId);
}