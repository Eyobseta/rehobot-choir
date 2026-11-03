import { apiPost, apiGet, http } from './api';
import { saveTokens, clearTokens, getAccessToken } from './secureStorage';
import { setCacheScope } from './cache';
import { setPersisterScope } from './queryPersister';
import { clearAllCaches } from './cacheWipe';
import { bumpSessionVersion, setSessionState } from './session';
import { registerDeviceWithBackend } from './pushTokens';

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

/**
 * Clears the saved role. Uses a dynamic import because role.ts imports
 * this file (a normal import would be circular).
 */
async function clearStoredRole(): Promise<void> {
  try {
    const { setRole } = await import('./role');
    setRole(null);
  } catch {
    // ignore
  }
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  // Lock the session BEFORE saving tokens
  bumpSessionVersion();

  const res = await apiPost<LoginResponse>('/auth/login', input);
  await saveTokens(res.accessToken, res.refreshToken);

  // Cache scope: keep the hand-rolled cache and the TanStack persister
  // in lockstep. Both are wiped together on logout via clearAllCaches().
  setCacheScope(res.user.id);
  setPersisterScope(res.user.id);

  setSessionState('authenticated');

  // Fire-and-forget: a push registration failure must never block login.
  void registerDeviceWithBackend();

  return res;
}

export async function logout(): Promise<void> {
  // Lock the session immediately
  bumpSessionVersion();
  setSessionState('unauthenticated');

  // Forget the saved role so it can't leak to the next login.
  await clearStoredRole();

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
    setPersisterScope(null);
    // Single wipe path: TanStack + cache.ts.
    await clearAllCaches();
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
  // Lock the session
  bumpSessionVersion();

  const res = await http.delete<{ ok: true }>('/auth/me', {
    data: { password },
  });
  // Session just ended; clear everything.
  await clearTokens();
  setCacheScope(null);
  setPersisterScope(null);
  await clearAllCaches();
  setSessionState('unauthenticated');
  await clearStoredRole();
  return res.data;
}