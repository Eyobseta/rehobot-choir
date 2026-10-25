import { apiPost, apiGet, http } from './api';
import { saveTokens, clearTokens, getAccessToken } from './secureStorage';
import { setCacheScope, cacheClearAll } from './cache';

export type LoginInput = {
  phone: string;
  password: string;
  deviceLabel?: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    email: string | null;
    role: 'MEMBER' | 'LEADER' | 'ADMIN';
    status: string;
  };
};

export type MeResponse = {
  user: {
    id: string;
    phone: string;
    email: string | null;
    role: 'MEMBER' | 'LEADER' | 'ADMIN';
    status: string;
    mustChangePassword: boolean;
    createdAt: string;
    lastActiveAt: string | null;
  };
};

export async function login(input: LoginInput): Promise<LoginResponse> {
  const res = await apiPost<LoginResponse>('/auth/login', input);
  await saveTokens(res.accessToken, res.refreshToken);
  // Set cache scope so the app never leaks data across accounts
  setCacheScope(res.user.id);
  return res;
}

export async function logout(): Promise<void> {
  try {
    const { unregisterDeviceFromBackend } = await import('./pushTokens');
    await unregisterDeviceFromBackend();
  } catch {
    // ignore
  }

  try {
    await apiPost('/auth/logout', {});
  } catch {
    // ignore
  } finally {
    await clearTokens();
    setCacheScope(null);
    await cacheClearAll();
  }
}

export async function me(): Promise<MeResponse> {
  return apiGet<MeResponse>('/auth/me');
}

export async function hasSession(): Promise<boolean> {
  const token = await getAccessToken();
  return Boolean(token);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>('/auth/change-password', {
    currentPassword,
    newPassword,
  });
}

export async function deleteOwnAccount(
  password: string,
): Promise<{ ok: true }> {
  const res = await http.delete<{ ok: true }>('/auth/me', {
    data: { password },
  });
  // Session just ended; clear everything.
  await clearTokens();
  setCacheScope(null);
  await cacheClearAll();
  return res.data;
}