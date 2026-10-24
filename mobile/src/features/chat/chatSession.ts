import { useEffect, useState } from 'react';
import { getAccessToken } from '../../services/secureStorage';
import type { UserRoleName } from './chatTypes';

export type Me = { id: string; role: UserRoleName };

let cache: { token: string; me: Me } | null = null;

function decodePayload(token: string): Me | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const json = atob(padded);
    const p = JSON.parse(json) as { sub?: string; role?: UserRoleName };
    if (!p.sub || !p.role) return null;
    return { id: p.sub, role: p.role };
  } catch {
    return null;
  }
}

/** Current user id + role, decoded from the access token (no extra request). */
export async function getMe(): Promise<Me | null> {
  const token = await getAccessToken();
  if (!token) return null;
  if (cache && cache.token === token) return cache.me;
  const me = decodePayload(token);
  if (me) cache = { token, me };
  return me;
}

export function clearMeCache(): void {
  cache = null;
}

export function isLeaderRole(role: UserRoleName | undefined | null): boolean {
  return role === 'LEADER' || role === 'ADMIN';
}

export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let alive = true;
    getMe().then((m) => {
      if (alive) setMe(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return me;
}
