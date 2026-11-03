import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBirthdayPost,
  setBirthdayReaction,
  removeBirthdayReaction,
  addBirthdayComment,
  deleteBirthdayComment,
  likeBirthdayComment,
  unlikeBirthdayComment,
} from '../../services/birthdays';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

export function useBirthdayPostQuery(id: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.birthdayPost(userId, id),
    queryFn: () => getBirthdayPost(id),
  });
}

function useInvalidate() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['birthdays', userId ?? 'anon'] });
}

export function useToggleReactionMutation() {
  const userId = useUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { postId: string; emoji: string; isMine: boolean }) => {
      if (v.isMine) await removeBirthdayReaction(v.postId, userId);
      else await setBirthdayReaction(v.postId, v.emoji, userId);
    },
    onSuccess: () => invalidate(),
  });
}

export function useToggleCommentLikeMutation() {
  const userId = useUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { commentId: string; liked: boolean }) => {
      if (v.liked) await unlikeBirthdayComment(v.commentId, userId);
      else await likeBirthdayComment(v.commentId, userId);
    },
    onSuccess: () => invalidate(),
  });
}

export function useAddCommentMutation() {
  const userId = useUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { postId: string; text: string; parentId: string | null }) =>
      addBirthdayComment(v.postId, v.text, v.parentId, userId),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCommentMutation() {
  const userId = useUserId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (commentId: string) => deleteBirthdayComment(commentId, userId),
    onSuccess: () => invalidate(),
  });
}