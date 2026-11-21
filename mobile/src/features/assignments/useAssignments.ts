import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getChoirAssignments,
  getLeaderAssignments,
  createAssignment,
  requestReassignment,
  resolveReassignment,
  cancelAssignment,
  reassignToMember,
} from '../../services/assignments';

const KEYS = {
  choir: ['assignments', 'choir'], // 🟢 NEW
  leader: ['assignments', 'leader'],
};

export function useChoirAssignmentsQuery() {
  return useQuery({
    queryKey: KEYS.choir,
    queryFn: getChoirAssignments,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLeaderAssignmentsQuery() {
  return useQuery({
    queryKey: KEYS.leader,
    queryFn: getLeaderAssignments,
  });
}

export function useReassignToMemberMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, newUserId }: { requestId: string; newUserId: string }) =>
      reassignToMember(requestId, newUserId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.choir });
      qc.invalidateQueries({ queryKey: KEYS.leader });
    },
  });
}

export function useCreateAssignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leader });
      qc.invalidateQueries({ queryKey: KEYS.choir });
    },
  });
}

export function useRequestReassignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      requestReassignment(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.choir });
      qc.invalidateQueries({ queryKey: KEYS.leader });
    },
  });
}

export function useResolveReassignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      resolveReassignment(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leader });
      qc.invalidateQueries({ queryKey: KEYS.choir });
    },
  });
}

export function useCancelAssignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leader });
      qc.invalidateQueries({ queryKey: KEYS.choir });
    },
  });
}