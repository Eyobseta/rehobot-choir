import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listMemories,
  listMemoryYears,
  getMemory,
  getMyMemory,
  listMyMemories,
} from '../../services/memories';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Read Hooks
// ---------------------------------------------------------------------------

export function useMemoriesQuery(search = '') {
  const userId = useUserId();
  const q = search.trim();
  return useQuery({
    queryKey: queryKeys.memoriesList(userId, q),
    queryFn: () => listMemories(q),
  });
}

export function useMemoryYearsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.memoryYears(userId),
    queryFn: listMemoryYears,
  });
}

export function useMemoryDetailQuery(id: string, mineOnly = false) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.memoryDetail(userId, id),
    queryFn: () => (mineOnly ? getMyMemory(id) : getMemory(id)),
  });
}

export function useMyMemoriesQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.myMemories(userId),
    queryFn: listMyMemories,
  });
}

// ---------------------------------------------------------------------------
// Background Prefetcher
// ---------------------------------------------------------------------------
let warmedThisSession = false;

/**
 * Prefetch the full detail of every memory into the cache, so memories
 * (title, description, media URLs) are available offline for the entire
 * library.
 */
export async function warmMemoryDetailCache(
  qc: ReturnType<typeof useQueryClient>,
  userId: string | null,
  memoryIds: string[]
): Promise<void> {
  if (warmedThisSession || !memoryIds.length) return;
  warmedThisSession = true;

  const missing = memoryIds.filter(
    (id) => qc.getQueryData(queryKeys.memoryDetail(userId, id)) === undefined
  );

  if (missing.length === 0) return;

  const CONCURRENCY = 3;
  const BATCH_PAUSE_MS = 200;

  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (id) => {
        try {
          await qc.prefetchQuery({
            queryKey: queryKeys.memoryDetail(userId, id),
            queryFn: () => getMemory(id),
          });
        } catch {
          // skip; try again next session
        }
      })
    );
    if (i + CONCURRENCY < missing.length) {
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  }
}