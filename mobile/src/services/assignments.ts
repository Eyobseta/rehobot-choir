import { apiGet, apiPost, http } from './api';

export type AssignmentRole = 'PRAYER_LEADER' | 'WORSHIP_LEADER';
export type GatheringType = 'TUESDAY_ZEMA' | 'THURSDAY_CHOIR' | 'SATURDAY_CHOIR' | 'SPECIAL_EVENT';

export type ChoirAssignment = {
  id: string;
  gatheringType: GatheringType;
  customGatheringName: string | null;
  date: { year: number; month: number; day: number };
  role: AssignmentRole;
  assignedUserId: string;
  assignedUserName: string;
  assignedBy: string;
  assignedById: string;
  hasPendingRequest: boolean;
};

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

// Fetch all for Home Screen
export async function getChoirAssignments(): Promise<ChoirAssignment[]> {
  const res = await apiGet<{ items: ChoirAssignment[] }>('/assignments/choir');
  return res.items;
}

export async function requestReassignment(assignmentId: string, reason: string) {
  return apiPost(`/assignments/${assignmentId}/reassign-request`, { reason });
}

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

export async function reassignToMember(requestId: string, newUserId: string) {
  return http.patch(`/leaders/assignments/requests/${requestId}/reassign`, { newUserId });
}

export async function cancelAssignment(assignmentId: string) {
  return http.delete(`/leaders/assignments/${assignmentId}`);
}