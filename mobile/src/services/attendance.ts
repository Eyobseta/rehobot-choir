import { apiGet, apiPost } from './api';

export type GatheringType =
  | 'TUESDAY_ZEMA'
  | 'THURSDAY_CHOIR'
  | 'SATURDAY_CHOIR';

export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export type AttendanceRow = {
  id: string;
  fullName: string;
  profilePhotoUrl: string | null;
  status: AttendanceStatus | null;
};

export type AttendanceForDate = {
  gathering: GatheringType;
  date: string;
  locked: boolean;
  roster: AttendanceRow[];
};

export type AttendanceHistoryItem = {
  id: string;
  gathering: GatheringType;
  date: string;
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
  from: string;
  to: string;
  rosterSize: number;
  days: GridDay[];
};

export type MyGridDay = {
  date: string;
  status: AttendanceStatus;
  gathering: GatheringType;
};

export type MyGridSummary = {
  from: string;
  to: string;
  days: MyGridDay[];
};

export async function leaderGetAttendance(
  gathering: GatheringType,
  date: string,
): Promise<AttendanceForDate> {
  return apiGet<AttendanceForDate>(
    `/leaders/attendance?gathering=${encodeURIComponent(gathering)}&date=${encodeURIComponent(date)}`,
  );
}

export async function leaderRecordAttendance(
  gathering: GatheringType,
  date: string,
  records: { memberId: string; status: AttendanceStatus }[],
): Promise<{ ok: true; count: number }> {
  return apiPost<{ ok: true; count: number }>('/leaders/attendance', {
    gathering,
    date,
    records,
  });
}

export async function getMyAttendance(
  limit = 60,
): Promise<AttendanceHistoryItem[]> {
  const res = await apiGet<{ items: AttendanceHistoryItem[] }>(
    `/attendance/me?limit=${limit}`,
  );
  return res.items;
}

export async function leaderGetGrid(
  gathering: GatheringType,
  from: string,
  to: string,
): Promise<GridSummary> {
  return apiGet<GridSummary>(
    `/leaders/attendance/grid?gathering=${encodeURIComponent(gathering)}&from=${from}&to=${to}`,
  );
}

export async function getMyGrid(
  from: string,
  to: string,
): Promise<MyGridSummary> {
  return apiGet<MyGridSummary>(`/attendance/grid/me?from=${from}&to=${to}`);
}

export async function leaderGetMemberGrid(
  memberId: string,
  from: string,
  to: string,
): Promise<MyGridSummary> {
  return apiGet<MyGridSummary>(
    `/leaders/attendance/members/${memberId}/grid?from=${from}&to=${to}`,
  );
}

export function gatheringLabelKey(g: GatheringType): string {
  switch (g) {
    case 'TUESDAY_ZEMA':
      return 'attendance.tuesdayZema';
    case 'THURSDAY_CHOIR':
      return 'attendance.thursdayChoir';
    case 'SATURDAY_CHOIR':
      return 'attendance.saturdayChoir';
  }
}