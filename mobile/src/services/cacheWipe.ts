import { queryClient } from './queryClient';
import { queryPersister } from './queryPersister';
import { cacheClearAll } from './cache';

/**
 * The single wipe path. Called from:
 *   - manual logout      (services/auth.ts::logout)
 *   - account deletion   (services/auth.ts::deleteOwnAccount)
 *   - forced logout (401) (App.tsx setOnUnauthorized)
 *   - any future "clear cache" action
 *
 * Wipes:
 *   1. In-flight queries (cancel).
 *   2. The AsyncStorage persister for this user (removes @rehobot/cache/@tanstack/<scope>).
 *   3. All in-memory query state.
 *   4. Everything `cache.ts` owns (`@rehobot/cache/**`).
 *
 * Order matters: cancel -> remove persister -> clear client -> clear disk.
 * If we cleared the disk first, an in-flight refetch could write to disk
 * after `clear()` and repopulate the cache for a logged-out user.
 */
export async function clearAllCaches(): Promise<void> {
  try {
    await queryClient.cancelQueries();
  } catch {
    // non-fatal
  }
  try {
    await queryPersister.removeClient();
  } catch {
    // non-fatal
  }
  try {
    queryClient.clear();
  } catch {
    // non-fatal
  }
  try {
    await cacheClearAll();
  } catch {
    // non-fatal
  }
}