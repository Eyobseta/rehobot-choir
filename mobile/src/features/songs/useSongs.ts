import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listSongs,
  getSong,
  listCategories,
  listMyFavorites,
  favoriteSong,
  unfavoriteSong,
} from '../../services/songs';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Read Hooks
// ---------------------------------------------------------------------------

export function useSongsQuery(search = '') {
  const userId = useUserId();
  const q = search.trim();
  return useQuery({
    queryKey: queryKeys.songsList(userId, q),
    queryFn: () => listSongs(q),
  });
}

export function useSongDetailQuery(id: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.songDetail(userId, id),
    queryFn: () => getSong(id),
  });
}

export function useSongCategoriesQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.songCategories(userId),
    queryFn: listCategories,
  });
}

export function useFavoriteSongsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.songFavorites(userId),
    queryFn: listMyFavorites,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useToggleFavoriteMutation() {
  const userId = useUserId();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isFav }: { id: string; isFav: boolean }) => {
      if (isFav) await unfavoriteSong(id);
      else await favoriteSong(id);
    },
    onSuccess: () => {
      // Invalidate both the favorites list and the individual song detail
      qc.invalidateQueries({ queryKey: queryKeys.songFavorites(userId) });
      qc.invalidateQueries({ queryKey: ['songs', userId, 'detail'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Background Prefetcher for Lyrics
// ---------------------------------------------------------------------------
let warmedThisSession = false;

/**
 * Prefetch the full detail (including lyrics) of every song into the cache,
 * so lyrics are available offline for the entire library.
 *
 * - Runs at most once per app session.
 * - Skips songs whose detail is already cached.
 * - Throttled: 3 concurrent requests, 200ms pause between batches.
 */
export async function warmSongDetailCache(
  qc: ReturnType<typeof useQueryClient>,
  userId: string | null,
  songIds: string[]
): Promise<void> {
  if (warmedThisSession || !songIds.length) return;
  warmedThisSession = true;

  const missing = songIds.filter(
    (id) => qc.getQueryData(queryKeys.songDetail(userId, id)) === undefined
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
            queryKey: queryKeys.songDetail(userId, id),
            queryFn: () => getSong(id),
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