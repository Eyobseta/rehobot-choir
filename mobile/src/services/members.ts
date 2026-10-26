import { apiGet, apiPatch, http } from './api';
import type { EthDate } from '../utils/ethiopianCalendar';

export type DirectoryMember = {
  id: string;
  fullName: string;
  profilePhotoUrl: string | null;
  lastActiveAt: string | null;
};

export type MemberDetail = {
  id: string;
  fullName: string;
  profilePhotoUrl: string | null;
  phone?: string;
  email?: string | null;
  gender?: string | null;
  dateOfBirth?: EthDate | null;   // FIXED: was string
  joiningDate?: EthDate | null;   // FIXED: was string
  lastActiveAt?: string | null;
  deleted: boolean;
};

export type OwnProfile = {
  id: string;
  role: 'MEMBER' | 'LEADER' | 'ADMIN';
  status: string;
  editable: {
    phone: string;
    email: string | null;
    emergencyContactName: string;
    emergencyContactPhone: string;
    profilePhotoUrl: string | null;
  };
  official: {
    fullName: string;
    gender: string;
    dateOfBirth: EthDate | null;   // FIXED: was string
    joiningDate: EthDate | null;   // FIXED: was string
  };
};

export async function listMembers(search?: string): Promise<DirectoryMember[]> {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const res = await apiGet<{ items: DirectoryMember[] }>(`/members${q}`);
  return res.items;
}

export async function getMember(id: string): Promise<MemberDetail> {
  const res = await apiGet<{ member: MemberDetail }>(`/members/${id}`);
  return res.member;
}

export async function getOwnProfile(): Promise<OwnProfile> {
  const res = await apiGet<{ profile: OwnProfile }>('/members/me/profile');
  return res.profile;
}

export type UpdateProfileInput = {
  email?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export async function updateOwnProfile(
  input: UpdateProfileInput,
): Promise<OwnProfile> {
  const res = await apiPatch<{ profile: OwnProfile }>(
    '/members/me/profile',
    input,
  );
  return res.profile;
}

export async function uploadOwnPhoto(photoUri: string): Promise<{ profilePhotoUrl: string }> {
  const form = new FormData();
  const filename = photoUri.split('/').pop() ?? 'photo.jpg';

  // @ts-expect-error — RN FormData type differs from DOM FormData
  form.append('photo', {
    uri: photoUri,
    name: filename,
    type: 'image/jpeg',
  });

  const res = await http.post<{ profilePhotoUrl: string }>(
    '/members/me/profile/photo',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
      transformRequest: (data) => data,
    },
  );
  return { profilePhotoUrl: res.data.profilePhotoUrl };
}

/**
 * Return online state + relative "last seen" string.
 * Anything under 2 minutes counts as online.
 */
export function describeLastSeen(iso: string | null): {
  online: boolean;
  label: string;
} {
  if (!iso) return { online: false, label: '' };
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 120) return { online: true, label: '' };
  if (diffSec < 3600)
    return { online: false, label: `Last seen ${Math.floor(diffSec / 60)}m ago` };
  if (diffSec < 86400)
    return { online: false, label: `Last seen ${Math.floor(diffSec / 3600)}h ago` };
  return {
    online: false,
    label: `Last seen ${Math.floor(diffSec / 86400)}d ago`,
  };
}

export type BirthdayPerson = {
  userId: string;
  fullName: string;
  profilePhotoUrl: string | null;
  postId: string;
};

export type BirthdaysResponse = {
  today: BirthdayPerson[];
  tomorrow: BirthdayPerson[];
};

export async function listBirthdays(): Promise<BirthdaysResponse> {
  return apiGet<BirthdaysResponse>('/members/birthdays');
}