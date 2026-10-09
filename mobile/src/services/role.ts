import { me } from './auth';

type Listener = (role: 'MEMBER' | 'LEADER' | 'ADMIN' | null) => void;

let currentRole: 'MEMBER' | 'LEADER' | 'ADMIN' | null = null;
const listeners = new Set<Listener>();

export function getRole(): 'MEMBER' | 'LEADER' | 'ADMIN' | null {
  return currentRole;
}

export function setRole(role: 'MEMBER' | 'LEADER' | 'ADMIN' | null): void {
  currentRole = role;
  for (const l of listeners) l(role);
}

export function subscribeRole(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Fetches /auth/me and stores the current role.
 * Call this once after login and again on app resume.
 */
export async function refreshRole(): Promise<void> {
  try {
    const res = await me();
    setRole(res.user.role);
  } catch {
    setRole(null);
  }
}

export function isLeader(): boolean {
  return currentRole === 'LEADER' || currentRole === 'ADMIN';
}