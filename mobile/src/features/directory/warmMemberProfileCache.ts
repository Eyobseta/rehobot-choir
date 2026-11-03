import { queryClient } from '../../services/queryClient';
import { queryKeys } from '../../services/queryKeys';
import { getMember } from '../../services/members';
import { getPersisterScope } from '../../services/queryPersister';

/**
 * Prefetch every member's profile into the TanStack cache, so tapping any
 * member in the Directory opens instantly online AND offline — after the
 * user opens Directory once while connected.
 *
 * Mirrors the existing helpers:
 *   - warmSongDetailCache       (services/songs.ts)
 *   - warmMemoryDetailCache     (services/memories.ts)
 *   - warmAnnouncementDetailCache (services/announcements.ts)
 *
 * Behavior:
 *  - Runs at most once per app session.
 *  - Skips members whose profile is already cached.
 *  - Throttled: 3 concurrent requests, 200ms pause between batches.
 *  - Never throws. Failures are silently skipped for a future session.
 *  - Writes through the standard TanStack cache, so entries are persisted
 *    to AsyncStorage automatically (subject to `isPersistable` in
 *    queryPersister.ts) and survive cold start until logout.
 */

let warmedThisSession = false;

/** Test/diagnostic reset — force a re-warm without a full app reload. */
export function resetMemberProfileWarmGuard(): void {
  warmedThisSession = false;
}

const CONCURRENCY = 3;
const BATCH_PAUSE_MS = 200;

export async function warmMemberProfileCache(
  memberIds: string[],
): Promise<void> {
  if (warmedThisSession) return;
  warmedThisSession = true;

  if (memberIds.length === 0) return;

  const userId = getPersisterScope();

  // Skip any whose profile is already in cache.
  const missing: string[] = [];
  for (const id of memberIds) {
    const cached = queryClient.getQueryData(
      queryKeys.member(userId, id),
    );
    if (cached === undefined) missing.push(id);
  }
  if (missing.length === 0) return;

  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (id) => {
        try {
          await queryClient.prefetchQuery({
            queryKey: queryKeys.member(userId, id),
            queryFn: () => getMember(id),
          });
        } catch {
          // skip; try again next session
        }
      }),
    );
    if (i + CONCURRENCY < missing.length) {
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  }
}