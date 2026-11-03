import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';

/**
 * Bump this only when the persisted query *shapes* change in a way that would
 * break the UI on hydration (e.g. renaming a field across the app). Old cached
 * data at an older version is discarded safely on first launch after upgrade.
 */
export const CACHE_VERSION = 1;

/**
 * Same prefix as `cache.ts` (services/cache.ts). That is deliberate:
 *
 *   - `cacheClearAll()` already removes every key under `@rehobot/cache/`,
 *     so logout wipes both the hand-rolled cache and the TanStack persisted
 *     cache with one call.
 *   - The current user scope is read from the same source of truth, so one
 *     user can never read another user's persisted TanStack state.
 *
 * The key layout is:
 *
 *   @rehobot/cache/@tanstack/<scope>/<CACHE_VERSION>
 *
 * `scope` is the current user id (or `anon` before login).
 */
const PREFIX = '@rehobot/cache/@tanstack';

let currentScope = 'anon';

/** Called from auth (`login` / `logout` / `deleteOwnAccount`). */
export function setPersisterScope(userId: string | null): void {
  currentScope = userId ?? 'anon';
}

function storageKey(): string {
  return `${PREFIX}/${currentScope}/${CACHE_VERSION}`;
}

// ---------------------------------------------------------------------------
// Key allow/deny policy — never persist secrets
// ---------------------------------------------------------------------------
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

  // Non-persistable flag on any single query wins.
  if ((query.meta as { persist?: boolean } | undefined)?.persist === false) {
    return false;
  }

  const flat = JSON.stringify(query.queryKey).toLowerCase();
  return !DENY_KEY_FRAGMENTS.some((frag) => flat.includes(frag));
}

// ---------------------------------------------------------------------------
// The AsyncStorage persister
// ---------------------------------------------------------------------------
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: storageKey(),
  // Throttle writes so low-memory Android is not flooded. Default is 1000ms;
  // we make it explicit so behavior is not silently changed by a dependency upgrade.
  throttleTime: 1000,
});

/**
 * Persist options to pass to `<PersistQueryClientProvider />`.
 */
export function makePersistOptions(): Omit<
  PersistQueryClientOptions,
  'queryClient'
> {
  return {
    persister: queryPersister,
    // Never evict by age.
    maxAge: Infinity,
    // `buster` = cache version. Changing CACHE_VERSION invalidates all old data.
    buster: `v${CACHE_VERSION}`,
    dehydrateOptions: {
      shouldDehydrateQuery: isPersistable,
    },
  };
}