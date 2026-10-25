import { http, ApiError } from './api';
import { EthDate } from '../utils/ethiopianCalendar';

export type RegisterInput = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  gender: string;
  dateOfBirth: EthDate; // Changed: now an Ethiopian date object
  emergencyContactName: string;
  emergencyContactPhone: string;
  joiningDate?: EthDate; // Changed: now an Ethiopian date object
  photoUri: string;
  photoMimeType?: string;
};

export type RegisterResult = {
  applicationId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export type RegistrationStatus = {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

/**
 * Uploads the registration form + photo as multipart/form-data.
 * Dates are sent as JSON strings containing Ethiopian date objects.
 */
export async function register(
  input: RegisterInput,
): Promise<RegisterResult> {
  const form = new FormData();

  form.append('fullName', input.fullName);
  form.append('phone', input.phone);
  form.append('email', input.email);
  form.append('password', input.password);
  form.append('gender', input.gender);
  // Dates sent as JSON so backend can parse into EthDate
  form.append('dateOfBirth', JSON.stringify(input.dateOfBirth));
  form.append('emergencyContactName', input.emergencyContactName);
  form.append('emergencyContactPhone', input.emergencyContactPhone);
  if (input.joiningDate) {
    form.append('joiningDate', JSON.stringify(input.joiningDate));
  }

  const filename = input.photoUri.split('/').pop() ?? 'photo.jpg';
  const mime = input.photoMimeType ?? 'image/jpeg';

  // @ts-expect-error — RN FormData type differs from DOM FormData
  form.append('photo', {
    uri: input.photoUri,
    name: filename,
    type: mime,
  });

  try {
    const res = await http.post<RegisterResult>('/auth/register', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
      transformRequest: (data) => data,
    });
    return res.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your internet connection.',
    );
  }
}

export async function getRegistrationStatus(
  phone: string,
): Promise<RegistrationStatus> {
  return http
    .get<RegistrationStatus>(
      `/auth/registration-status?phone=${encodeURIComponent(phone)}`,
    )
    .then((res) => res.data);
}