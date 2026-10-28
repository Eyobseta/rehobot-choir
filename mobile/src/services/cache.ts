import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@rehobot/cache/';

// Cache policy: entries never expire by time. They persist until the user
// clears app data, uninstalls the app, or logs out (logout calls
// cacheClearAll()). Old entries that carry a `ttlMs` field from a previous
// build are still readable; the field is ignored.
type Entry<T> = {
  data: T;
  savedAt: number;
  ttlMs?: number; // legacy, unused
};

// In-memory layer: makes reads synchronous after first load.
const memory = new Map<string, Entry<unknown>>();

let currentUserScope = 'anon';

/**
 * Set the cache scope per user (so switching accounts never leaks data).
 * Call this on login/logout with the userId (or 'anon').
 */
export function setCacheScope(userId: string | null): void {
  const next = userId ?? 'anon';
  if (next === currentUserScope) return;
  currentUserScope = next;
  memory.clear();
}

function fullKey(key: string): string {
  return `${PREFIX}${currentUserScope}/${key}`;
}

/**
 * Read from cache. Returns undefined only if the key has never been written
 * or has been explicitly removed. Cached data does not expire by age.
 *
 * `opts` is accepted for backwards compatibility and ignored.
 */
export async function cacheRead<T>(
  key: string,
  _opts: { allowExpired?: boolean } = {},
): Promise<T | undefined> {
  const fk = fullKey(key);

  const mem = memory.get(fk) as Entry<T> | undefined;
  if (mem) return mem.data;

  try {
    const raw = await AsyncStorage.getItem(fk);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry<T>;
    memory.set(fk, entry as Entry<unknown>);
    return entry.data;
  } catch {
    return undefined;
  }
}

/**
 * Write to cache. Cached data never expires by age.
 *
 * The third `_ttlMs` parameter is accepted for backwards compatibility and
 * ignored. New code should call `cacheWrite(key, data)`.
 */
export async function cacheWrite<T>(
  key: string,
  data: T,
  _ttlMs?: number,
): Promise<void> {
  const fk = fullKey(key);
  const entry: Entry<T> = { data, savedAt: Date.now() };
  memory.set(fk, entry as Entry<unknown>);
  try {
    await AsyncStorage.setItem(fk, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

/**
 * Delete one key.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  const fk = fullKey(key);
  memory.delete(fk);
  try {
    await AsyncStorage.removeItem(fk);
  } catch {
    // ignore
  }
}

/**
 * Delete every key that starts with a prefix (e.g. 'events' → 'events:list').
 */
export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  const fullPrefix = fullKey(prefix);
  for (const k of Array.from(memory.keys())) {
    if (k.startsWith(fullPrefix)) memory.delete(k);
  }
  try {
    const all = await AsyncStorage.getAllKeys();
    const toRemove = all.filter((k) => k.startsWith(fullPrefix));
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  } catch {
    // ignore
  }
}

/**
 * Wipe the current user's entire cache. Call this on logout.
 */
export async function cacheClearAll(): Promise<void> {
  memory.clear();
  try {
    const all = await AsyncStorage.getAllKeys();
    const toRemove = all.filter((k) => k.startsWith(PREFIX));
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  } catch {
    // ignore
  }
}

/**
 * One-liner: read from cache and fetch fresh. Returns cached (if any) instantly,
 * then updates in background via `onFresh`.
 *
 *   await cachedFetch('events:upcoming',
 *     () => listEvents('upcoming'),
 *     (fresh) => setItems(fresh),
 *   );
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  onFresh: (data: T) => void,
): Promise<T | undefined> {
  const cached = await cacheRead<T>(key);
  const fresh = fetcher().then(async (data) => {
    await cacheWrite(key, data);
    onFresh(data);
    return data;
  });
  return cached ?? fresh;
}