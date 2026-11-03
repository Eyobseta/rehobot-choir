import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  leaderGetAttendance,
  getMyAttendance,
  leaderGetGrid,
  getMyGrid,
  leaderGetMemberGrid,
  leaderRecordAttendance,
  type GatheringType,
  type AttendanceStatus,
} from '../../services/attendance';
import { EthDate, ethToUtcDate } from '../../utils/ethiopianCalendar';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// Convert EthDate to a string for the query key (e.g., "2016-01-01")
function ethKey(d: EthDate): string {
  return `${d.year}-${d.month}-${d.day}`;
}

// ---------------------------------------------------------------------------
// Read Hooks
// ---------------------------------------------------------------------------

export function useLeaderAttendanceQuery(gathering: GatheringType, date: EthDate) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.leaderAttendance(userId, gathering, ethKey(date)),
    queryFn: () => leaderGetAttendance(gathering, date),
  });
}

export function useMyAttendanceQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.myAttendance(userId),
    queryFn: () => getMyAttendance(),
  });
}

export function useLeaderAttendanceGridQuery(gathering: GatheringType, from: EthDate, to: EthDate) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.leaderAttendanceGrid(userId, gathering, ethKey(from), ethKey(to)),
    queryFn: () => leaderGetGrid(gathering, from, to),
  });
}

export function useMyAttendanceGridQuery(from: EthDate, to: EthDate) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.myAttendanceGrid(userId, ethKey(from), ethKey(to)),
    queryFn: () => getMyGrid(from, to),
  });
}

export function useMemberAttendanceGridQuery(memberId: string, from: EthDate, to: EthDate) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.memberAttendanceGrid(userId, memberId, ethKey(from), ethKey(to)),
    queryFn: () => leaderGetMemberGrid(memberId, from, to),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useRecordAttendanceMutation() {
  const userId = useUserId();
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: (v: {
      gathering: GatheringType;
      date: EthDate;
      records: { memberId: string; status: AttendanceStatus }[];
    }) => leaderRecordAttendance(v.gathering, v.date, v.records, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', userId ?? 'anon'] });
    },
  });
}