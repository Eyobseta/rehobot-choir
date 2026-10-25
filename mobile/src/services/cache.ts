import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@rehobot/cache/';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type Entry<T> = {
  data: T;
  savedAt: number;
  ttlMs: number;
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
 * Read from cache. Returns undefined if missing or expired (expired items are dropped).
 */
export async function cacheRead<T>(
  key: string,
  opts: { allowExpired?: boolean } = {},
): Promise<T | undefined> {
  const fk = fullKey(key);

  const mem = memory.get(fk) as Entry<T> | undefined;
  if (mem) {
    if (opts.allowExpired || Date.now() - mem.savedAt < mem.ttlMs) {
      return mem.data;
    }
    memory.delete(fk);
  }

  try {
    const raw = await AsyncStorage.getItem(fk);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry<T>;
    if (!opts.allowExpired && Date.now() - entry.savedAt >= entry.ttlMs) {
      await AsyncStorage.removeItem(fk);
      return undefined;
    }
    memory.set(fk, entry);
    return entry.data;
  } catch {
    return undefined;
  }
}

/**
 * Write to cache. TTL defaults to 24h.
 */
export async function cacheWrite<T>(
  key: string,
  data: T,
  ttlMs = DEFAULT_TTL_MS,
): Promise<void> {
  const fk = fullKey(key);
  const entry: Entry<T> = { data, savedAt: Date.now(), ttlMs };
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
  opts: { ttlMs?: number } = {},
): Promise<T | undefined> {
  const cached = await cacheRead<T>(key);
  const fresh = fetcher().then(async (data) => {
    await cacheWrite(key, data, opts.ttlMs);
    onFresh(data);
    return data;
  });
  return cached ?? fresh;
}