import { getAccessToken } from './secureStorage';

export type SessionState = 'authenticated' | 'unauthenticated';

let cachedState: SessionState | null = null;
let currentVersion = 0; // NEW: Session lock

type Listener = (state: SessionState) => void;
const listeners = new Set<Listener>();

/**
 * Get the current session version.
 * Call this BEFORE an async operation, and check it AFTER.
 */
export function getSessionVersion(): number {
  return currentVersion;
}

/**
 * Invalidate any in-flight requests (like token refreshes).
 * Call this on login, logout, and account deletion.
 */
export function bumpSessionVersion(): number {
  currentVersion += 1;
  return currentVersion;
}

/**
 * Read session state from SecureStore.
 *
 * Session lifetime is governed by the refresh token (7 days of inactivity),
 * not by a client-side timer. This function only checks whether a token
 * physically exists on the device.
 */
export async function refreshSessionState(): Promise<SessionState> {
  const token = await getAccessToken();
  cachedState = token ? 'authenticated' : 'unauthenticated';
  return cachedState;
}

export function getSessionState(): SessionState | null {
  return cachedState;
}

export function setSessionState(state: SessionState): void {
  cachedState = state;
  for (const l of listeners) l(state);
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}