import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listEvents,
  getEvent,
  leaderListEvents,
  rsvp as rsvpApi,
  clearRsvp as clearRsvpApi,
  leaderCreateEvent,
  leaderUpdateEvent,
  leaderDeleteEvent,
  type EventDetail,
  type CreateEventInput,
  type UpdateEventInput,
  type RsvpResponse,
} from '../../services/events';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Read Hooks
// ---------------------------------------------------------------------------

export function useEventsQuery(scope: 'upcoming' | 'past') {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.events(userId, scope),
    queryFn: () => listEvents(scope),
  });
}

export function useEventDetailQuery(id: string, options?: { enabled?: boolean }) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.eventDetail(userId, id),
    queryFn: () => getEvent(id),
    enabled: options?.enabled ?? true,
  });
}

export function useLeaderEventsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.leaderEvents(userId),
    queryFn: leaderListEvents,
  });
}

// ---------------------------------------------------------------------------
// Mutations — invalidate the shared events tree after success
// ---------------------------------------------------------------------------

function useInvalidateEvents() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ['events', userId ?? 'anon'] });
}

export function useRsvpMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (v: { id: string; response: RsvpResponse }) =>
      rsvpApi(v.id, v.response, userId),
    onSuccess: () => invalidate(),
  });
}

export function useClearRsvpMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (id: string) => clearRsvpApi(id, userId),
    onSuccess: () => invalidate(),
  });
}

export function useCreateEventMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (input: CreateEventInput) => leaderCreateEvent(input, userId),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateEventMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (v: { id: string; input: UpdateEventInput }) =>
      leaderUpdateEvent(v.id, v.input, userId),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteEventMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (id: string) => leaderDeleteEvent(id, userId),
    onSuccess: () => invalidate(),
  });
}

// ---------------------------------------------------------------------------
// Background Prefetcher
// ---------------------------------------------------------------------------
let warmedThisSession = false;

/**
 * Prefetch the full detail of every event into the cache, so events are
 * available offline for the whole list — not only the ones the member has
 * opened while online.
 *
 * Mirrors warmSongDetailCache / warmMemoryDetailCache /
 * warmAnnouncementDetailCache.
 *
 * - Runs at most once per app session.
 * - Skips events whose detail is already cached.
 * - Concurrency 3, 200 ms pause between batches.
 * - Never throws.
 */
export async function warmEventDetailCache(
  qc: ReturnType<typeof useQueryClient>,
  userId: string | null,
  eventIds: string[],
): Promise<void> {
  if (warmedThisSession || !eventIds.length) return;
  warmedThisSession = true;

  const missing = eventIds.filter(
    (id) => qc.getQueryData(queryKeys.eventDetail(userId, id)) === undefined,
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
            queryKey: queryKeys.eventDetail(userId, id),
            queryFn: () => getEvent(id),
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