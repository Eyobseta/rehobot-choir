import * as SecureStore from 'expo-secure-store';
import { me } from './auth';
import type { ApiError } from './api';

type Role = 'MEMBER' | 'LEADER' | 'ADMIN';
type Listener = (role: Role | null) => void;

const STORAGE_KEY = 'auth.role.v1';
const VALID_ROLES: Role[] = ['MEMBER', 'LEADER', 'ADMIN'];

let currentRole: Role | null = null;
let currentUserId: string | null = null;
const listeners = new Set<Listener>();

async function persist(role: Role | null, userId: string | null): Promise<void> {
  try {
    if (role === null) {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ role, userId }));
    }
  } catch {
    // non-fatal: worst case the role isn't remembered offline
  }
}

export function getRole(): Role | null {
  return currentRole;
}

/** User id saved with the role, so cache scope can be restored offline. */
export function getStoredUserId(): string | null {
  return currentUserId;
}

export function setRole(role: Role | null, userId?: string | null): void {
  currentRole = role;
  if (role === null) currentUserId = null;
  else if (userId !== undefined) currentUserId = userId;
  for (const l of listeners) l(role);
  void persist(role, currentUserId);
}

export function subscribeRole(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Load the last known role from the device (works offline). */
export async function loadStoredRole(): Promise<Role | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: Role; userId?: string | null };
    if (!parsed.role || !VALID_ROLES.includes(parsed.role)) return null;
    currentRole = parsed.role;
    currentUserId = parsed.userId ?? null;
    for (const l of listeners) l(currentRole);
    return currentRole;
  } catch {
    return null;
  }
}

/**
 * Fetches /auth/me and stores the current role.
 * - Success: update and save the role.
 * - 401/403: the server rejected us, so clear the role.
 * - Offline / timeout / server error: KEEP the last known role.
 * Call this once after login and again on app resume.
 */
export async function refreshRole(): Promise<void> {
  try {
    const res = await me();
    setRole(res.user.role, res.user.id);
  } catch (e) {
    const status = (e as ApiError)?.status;
    if (status === 401 || status === 403) {
      setRole(null);
      return;
    }
    // Network problem: keep what we have, or fall back to the saved role.
    if (currentRole === null) await loadStoredRole();
  }
}

export function isLeader(): boolean {
  return currentRole === 'LEADER' || currentRole === 'ADMIN';
}