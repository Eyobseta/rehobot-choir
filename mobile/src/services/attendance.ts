import { apiGet, apiPost } from './api';
import { queryClient } from './queryClient';
import { EthDate } from '../utils/ethiopianCalendar';

export type GatheringType = 'TUESDAY_ZEMA' | 'THURSDAY_CHOIR' | 'SATURDAY_CHOIR';
export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export type AttendanceRow = {
  id: string;
  fullName: string;
  profilePhotoUrl: string | null;
  status: AttendanceStatus | null;
};

export type AttendanceForDate = {
  gathering: GatheringType;
  date: EthDate;
  locked: boolean;
  roster: AttendanceRow[];
};

export type AttendanceHistoryItem = {
  id: string;
  gathering: GatheringType;
  dateEthYear: number;
  dateEthMonth: number;
  dateEthDay: number;
  dateGregorian: string;
  status: AttendanceStatus;
};

export type GridDay = {
  date: string;
  present: number;
  absent: number;
  total: number;
  marked: number;
};

export type GridSummary = {
  gathering: GatheringType;
  from: EthDate;
  to: EthDate;
  rosterSize: number;
  days: GridDay[];
};

export type MyGridDay = {
  isoDate: string;
  date: EthDate;
  status: AttendanceStatus;
  gathering: GatheringType;
};

export type MyGridSummary = {
  from: EthDate;
  to: EthDate;
  days: MyGridDay[];
};

function ethQ(d: EthDate): string {
  return encodeURIComponent(JSON.stringify(d));
}

// ---------- Reads ----------

export async function leaderGetAttendance(
  gathering: GatheringType,
  date: EthDate,
): Promise<AttendanceForDate> {
  return apiGet<AttendanceForDate>(
    `/leaders/attendance?gathering=${gathering}&date=${ethQ(date)}`,
  );
}

export async function getMyAttendance(limit = 60): Promise<AttendanceHistoryItem[]> {
  const res = await apiGet<{ items: AttendanceHistoryItem[] }>(`/attendance/me?limit=${limit}`);
  return res.items;
}

export async function leaderGetGrid(
  gathering: GatheringType,
  from: EthDate,
  to: EthDate,
): Promise<GridSummary> {
  return apiGet<GridSummary>(
    `/leaders/attendance/grid?gathering=${gathering}&from=${ethQ(from)}&to=${ethQ(to)}`,
  );
}

export async function getMyGrid(
  from: EthDate,
  to: EthDate,
): Promise<MyGridSummary> {
  return apiGet<MyGridSummary>(
    `/attendance/grid/me?from=${ethQ(from)}&to=${ethQ(to)}`,
  );
}

export async function leaderGetMemberGrid(
  memberId: string,
  from: EthDate,
  to: EthDate,
): Promise<MyGridSummary> {
  return apiGet<MyGridSummary>(
    `/leaders/attendance/members/${memberId}/grid?from=${ethQ(from)}&to=${ethQ(to)}`,
  );
}

// ---------- Mutations (Invalidate via TanStack) ----------

export async function leaderRecordAttendance(
  gathering: GatheringType,
  date: EthDate,
  records: { memberId: string; status: AttendanceStatus }[],
  userId: string | null,
): Promise<{ ok: true; count: number }> {
  const res = await apiPost<{ ok: true; count: number }>('/leaders/attendance', {
    gathering,
    date,
    records,
  });
  
  // Invalidate all attendance caches for this user
  await queryClient.invalidateQueries({
    queryKey: ['attendance', userId ?? 'anon'],
  });
  
  return res;
}

export function gatheringLabelKey(g: GatheringType): string {
  switch (g) {
    case 'TUESDAY_ZEMA': return 'attendance.tuesdayZema';
    case 'THURSDAY_CHOIR': return 'attendance.thursdayChoir';
    case 'SATURDAY_CHOIR': return 'attendance.saturdayChoir';
  }
}