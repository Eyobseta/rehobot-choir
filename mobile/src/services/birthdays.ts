import { apiGet, apiPost, apiDelete } from './api';

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

export async function getBirthdayPost(id: string): Promise<BirthdayPostDetail> {
  const res = await apiGet<{ post: BirthdayPostDetail }>(
    `/birthdays/posts/${id}`,
  );
  return res.post;
}

export async function setBirthdayReaction(
  postId: string,
  emoji: string,
): Promise<void> {
  await apiPost(`/birthdays/posts/${postId}/reaction`, { emoji });
}

export async function removeBirthdayReaction(postId: string): Promise<void> {
  await apiDelete(`/birthdays/posts/${postId}/reaction`);
}

export async function addBirthdayComment(
  postId: string,
  text: string,
  parentCommentId?: string | null,
): Promise<{ id: string }> {
  return apiPost<{ id: string }>(`/birthdays/posts/${postId}/comments`, {
    text,
    parentCommentId: parentCommentId ?? null,
  });
}

export async function deleteBirthdayComment(id: string): Promise<void> {
  await apiDelete(`/birthdays/comments/${id}`);
}

export async function likeBirthdayComment(id: string): Promise<void> {
  await apiPost(`/birthdays/comments/${id}/like`, {});
}

export async function unlikeBirthdayComment(id: string): Promise<void> {
  await apiDelete(`/birthdays/comments/${id}/like`);
}