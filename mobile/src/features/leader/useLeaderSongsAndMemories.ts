import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  leaderListSongs,
  leaderApproveSubmission,
  leaderReturnSubmission,
  leaderListPendingSubmissions,
} from '../../services/songs';
import {
  leaderListPendingMemories,
  leaderGetMemory,
  leaderApproveMemory,
  leaderRejectMemory,
  leaderDeleteMemory,
} from '../../services/memories';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

function invalidateSongs(userId: string | null) {
  return [
    { queryKey: ['leader', userId ?? 'anon', 'songs'] },
    { queryKey: ['songs', userId ?? 'anon'] }, // public song list also invalidated
  ];
}

// ---------------------------------------------------------------------------
// Leader Songs list
// ---------------------------------------------------------------------------

export function useLeaderSongsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.leaderSongs(userId),
    queryFn: leaderListSongs,
  });
}

// ---------------------------------------------------------------------------
// Leader Song Review queue
// ---------------------------------------------------------------------------

export function useSongReviewQueueQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.songReviewQueue(userId),
    queryFn: leaderListPendingSubmissions,
  });
}

function useInvalidateSongReview() {
  const userId = useUserId();
  const qc = useQueryClient();
  return async () => {
    const keys = invalidateSongs(userId);
    await Promise.all(keys.map((k) => qc.invalidateQueries(k)));
  };
}

export function useApproveSongSubmissionMutation() {
  const invalidate = useInvalidateSongReview();
  return useMutation({
    mutationFn: (submissionId: string) => leaderApproveSubmission(submissionId),
    onSuccess: () => invalidate(),
  });
}

export function useReturnSongSubmissionMutation() {
  const invalidate = useInvalidateSongReview();
  return useMutation({
    mutationFn: (v: { submissionId: string; reason: string }) =>
      leaderReturnSubmission(v.submissionId, v.reason),
    onSuccess: () => invalidate(),
  });
}

// ---------------------------------------------------------------------------
// Leader Memories review
// ---------------------------------------------------------------------------

export function useLeaderPendingMemoriesQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.leaderMemoriesPending(userId),
    queryFn: leaderListPendingMemories,
  });
}

export function useLeaderMemoryQuery(id: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.leaderMemoryDetail(userId, id),
    queryFn: () => leaderGetMemory(id),
  });
}

function useInvalidateLeaderMemories() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      queryKey: ['leader', userId ?? 'anon', 'memories'],
    });
}

export function useApproveMemoryMutation() {
  const invalidate = useInvalidateLeaderMemories();
  return useMutation({
    mutationFn: (id: string) => leaderApproveMemory(id),
    onSuccess: () => invalidate(),
  });
}

export function useRejectMemoryMutation() {
  const invalidate = useInvalidateLeaderMemories();
  return useMutation({
    mutationFn: (v: { id: string; reason?: string }) =>
      leaderRejectMemory(v.id, v.reason),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteMemoryMutation() {
  const invalidate = useInvalidateLeaderMemories();
  return useMutation({
    mutationFn: (id: string) => leaderDeleteMemory(id),
    onSuccess: () => invalidate(),
  });
}