import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';

/**
 * Bump this only when the persisted query *shapes* change in a way that would
 * break the UI on hydration.
 */
export const CACHE_VERSION = 1;

/**
 * Same prefix as `cache.ts` (services/cache.ts). `cacheClearAll()` already
 * removes every key under `@rehobot/cache/`, so logout wipes both the
 * hand-rolled cache and the TanStack persisted cache with one call.
 */
const PREFIX = '@rehobot/cache/@tanstack';

let currentScope = 'anon';

/** Called from auth (`login` / `logout` / `deleteOwnAccount`). */
export function setPersisterScope(userId: string | null): void {
  currentScope = userId ?? 'anon';
}

/**
 * Read the current scope. Returns null when unauthenticated.
 * Safe to call from anywhere (including outside React).
 */
export function getPersisterScope(): string | null {
  return currentScope === 'anon' ? null : currentScope;
}

function storageKey(): string {
  return `${PREFIX}/${currentScope}/${CACHE_VERSION}`;
}

const DENY_KEY_FRAGMENTS = [
  'token',
  'auth',
  'password',
  'pin',
  'otp',
  'secret',
  'credential',
];

function isPersistable(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  if ((query.meta as { persist?: boolean } | undefined)?.persist === false) {
    return false;
  }
  const flat = JSON.stringify(query.queryKey).toLowerCase();
  return !DENY_KEY_FRAGMENTS.some((frag) => flat.includes(frag));
}

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: storageKey(),
  throttleTime: 1000,
});

export function makePersistOptions(): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: queryPersister,
    maxAge: Infinity,
    buster: `v${CACHE_VERSION}`,
    dehydrateOptions: {
      shouldDehydrateQuery: isPersistable,
    },
  };
}