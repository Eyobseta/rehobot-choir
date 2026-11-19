import { apiGet, apiPost, http } from './api';

export type AssignmentRole = 'PRAYER_LEADER' | 'WORSHIP_LEADER';
export type GatheringType = 'TUESDAY_ZEMA' | 'THURSDAY_CHOIR' | 'SATURDAY_CHOIR' | 'SPECIAL_EVENT';

export type Assignment = {
  id: string;
  gatheringType: GatheringType;
  customGatheringName: string | null;
  date: { year: number; month: number; day: number };
  role: AssignmentRole;
  status: string;
  assignedBy: string;
  assignedById: string;
  pendingRequest?: { id: string; status: string; reason: string } | null;
};

export type LeaderAssignment = {
  id: string;
  gatheringType: GatheringType;
  customGatheringName: string | null;
  role: AssignmentRole;
  status: string;
  dateEthYear: number;
  dateEthMonth: number;
  dateEthDay: number;
  assignedUser: {
    id: string;
    memberProfile: { fullName: string; profilePhotoUrl: string } | null;
  };
};

export type ReassignmentRequest = {
  id: string;
  assignmentId: string;
  reason: string;
  status: string;
  createdAt: string;
  requester: { id: string; memberProfile: { fullName: string } | null };
  assignment: {
    role: AssignmentRole;
    gatheringType: GatheringType;
    dateEthYear: number;
    dateEthMonth: number;
    dateEthDay: number;
  };
};

// --- MEMBER ---
export async function getMyAssignments(): Promise<Assignment[]> {
  const res = await apiGet<{ items: Assignment[] }>('/assignments/me');
  return res.items;
}

export async function requestReassignment(assignmentId: string, reason: string) {
  return apiPost(`/assignments/${assignmentId}/reassign-request`, { reason });
}

// --- LEADER ---
export async function getLeaderAssignments(): Promise<{
  assignments: LeaderAssignment[];
  requests: ReassignmentRequest[];
}> {
  return apiGet('/leaders/assignments');
}

export async function createAssignment(data: {
  gatheringType: GatheringType;
  customGatheringName?: string;
  date: { year: number; month: number; day: number };
  role: AssignmentRole;
  assignedUserId: string;
}) {
  return apiPost('/leaders/assignments', data);
}

export async function resolveReassignment(requestId: string, status: 'APPROVED' | 'REJECTED') {
  return http.patch(`/leaders/assignments/requests/${requestId}`, { status });
}

export async function cancelAssignment(assignmentId: string) {
  return http.delete(`/leaders/assignments/${assignmentId}`);
}