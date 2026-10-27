import { apiGet, apiPost, http } from './api';

export type MemberLookup = {
  id: string;
  phone: string;
  email: string | null;
  role: 'MEMBER' | 'LEADER' | 'ADMIN';
  status: string;
  mustChangePassword: boolean;
  fullName: string | null;
  profilePhotoUrl: string | null;
};

export async function lookupMember(phone: string): Promise<MemberLookup> {
  const res = await apiGet<{ member: MemberLookup }>(
    `/leaders/members/lookup?phone=${encodeURIComponent(phone)}`,
  );
  return res.member;
}

export async function resetMemberPassword(
  memberId: string,
  newPassword: string, // ADDED
): Promise<{ temporaryPassword: string }> {
  return apiPost<{ temporaryPassword: string }>(
    `/leaders/members/${memberId}/reset-password`,
    { newPassword }, // SEND IN BODY
  );
}

export async function deleteMember(
  memberId: string,
  leaderPassword: string,
): Promise<{ ok: true }> {
  const res = await http.delete<{ ok: true }>(
    `/leaders/members/${memberId}`,
    { data: { leaderPassword } },
  );
  return res.data;
}

export async function appointMember(
  memberId: string,
): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>(
    `/leaders/members/${memberId}/appoint`,
    {},
  );
}