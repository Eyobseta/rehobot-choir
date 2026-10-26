import { apiGet, apiPost } from './api';

export type PendingApplication = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  gender: string;
  // Updated to match backend Ethiopian calendar fields
  dateOfBirthEthYear: number;
  dateOfBirthEthMonth: number;
  dateOfBirthEthDay: number;
  joiningDateEthYear: number | null;
  joiningDateEthMonth: number | null;
  joiningDateEthDay: number | null;
  profilePhotoUrl: string;
  createdAt: string;
};

export type ApplicationDetail = PendingApplication & {
  emergencyContactName: string;
  emergencyContactPhone: string;
  profilePhotoPublicId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

export async function listPendingApplications(): Promise<PendingApplication[]> {
  const res = await apiGet<{ items: PendingApplication[] }>(
    '/leaders/registrations',
  );
  return res.items;
}

export async function getApplication(
  id: string,
): Promise<ApplicationDetail> {
  const res = await apiGet<{ item: ApplicationDetail }>(
    `/leaders/registrations/${id}`,
  );
  return res.item;
}

export async function approveApplication(id: string): Promise<{ userId: string }> {
  return apiPost<{ userId: string }>(
    `/leaders/registrations/${id}/approve`,
    {},
  );
}

export async function rejectApplication(
  id: string,
  reason: string,
): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>(
    `/leaders/registrations/${id}/reject`,
    { reason },
  );
}