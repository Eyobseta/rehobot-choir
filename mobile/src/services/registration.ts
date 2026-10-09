import { http, ApiError } from './api';

export type RegisterInput = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  gender: string;
  dateOfBirth: string; // YYYY-MM-DD
  emergencyContactName: string;
  emergencyContactPhone: string;
  joiningDate?: string; // YYYY-MM-DD
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
 *
 * We use axios (already configured in ./api) instead of fetch because
 * React Native's fetch is unreliable with FormData on Android — it
 * frequently throws a bare "Network request failed" for reasons that
 * do not match what the server sees.
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
  form.append('dateOfBirth', input.dateOfBirth);
  form.append('emergencyContactName', input.emergencyContactName);
  form.append('emergencyContactPhone', input.emergencyContactPhone);
  if (input.joiningDate) form.append('joiningDate', input.joiningDate);

  // React Native expects an object with uri/name/type, not a Blob.
  const filename = input.photoUri.split('/').pop() ?? 'photo.jpg';
  const mime = input.photoMimeType ?? 'image/jpeg';

  // @ts-expect-error — RN FormData type differs from DOM FormData
  form.append('photo', {
    uri: input.photoUri,
    name: filename,
    type: mime,
  });

  // Logging helps during development. Remove later if desired.
  // eslint-disable-next-line no-console
  console.log('[register] POST', `${http.defaults.baseURL}/auth/register`);

  try {
    const res = await http.post<RegisterResult>('/auth/register', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Photo uploads can be slow on weak Wi-Fi — extend the default 15s.
      timeout: 60_000,
      // Prevent axios from JSON-encoding the FormData body.
      transformRequest: (data) => data,
    });
    // eslint-disable-next-line no-console
    console.log('[register] success', res.status);
    return res.data;
  } catch (err) {
    // The response interceptor in api.ts already normalizes errors to ApiError.
    // eslint-disable-next-line no-console
    console.log('[register] axios error:', err);
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