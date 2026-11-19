import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyAssignments,
  getLeaderAssignments,
  createAssignment,
  requestReassignment,
  resolveReassignment,
  cancelAssignment,
} from '../../services/assignments';

const KEYS = {
  me: ['assignments', 'me'],
  leader: ['assignments', 'leader'],
};

export function useMyAssignmentsQuery() {
  return useQuery({
    queryKey: KEYS.me,
    queryFn: getMyAssignments,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useLeaderAssignmentsQuery() {
  return useQuery({
    queryKey: KEYS.leader,
    queryFn: getLeaderAssignments,
  });
}

export function useCreateAssignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leader });
      qc.invalidateQueries({ queryKey: KEYS.me }); // In case leader is also assigned
    },
  });
}

export function useRequestReassignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      requestReassignment(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.me });
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
      qc.invalidateQueries({ queryKey: KEYS.me });
    },
  });
}

export function useCancelAssignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelAssignment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leader });
      qc.invalidateQueries({ queryKey: KEYS.me });
    },
  });
}