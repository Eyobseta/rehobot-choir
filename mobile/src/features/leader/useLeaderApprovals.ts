import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPendingApplications,
  getApplication,
  approveApplication,
  rejectApplication,
} from '../../services/leaders';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function usePendingApprovalsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.pendingApprovals(userId),
    queryFn: listPendingApplications,
  });
}

export function useApplicationDetailQuery(id: string, options?: { enabled?: boolean }) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.applicationDetail(userId, id),
    queryFn: () => getApplication(id),
    enabled: options?.enabled ?? true,
  });
}

// ---------------------------------------------------------------------------
// Mutations — invalidate the whole approvals tree on success
// ---------------------------------------------------------------------------

function useInvalidateApprovals() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      queryKey: ['leader', userId ?? 'anon', 'approvals'],
    });
}

export function useApproveApplicationMutation() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (id: string) => approveApplication(id),
    onSuccess: () => invalidate(),
  });
}

export function useRejectApplicationMutation() {
  const invalidate = useInvalidateApprovals();
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      rejectApplication(v.id, v.reason),
    onSuccess: () => invalidate(),
  });
}