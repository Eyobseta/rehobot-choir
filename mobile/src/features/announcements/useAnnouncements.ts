import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listAnnouncements,
  getAnnouncement,
  leaderListAnnouncements,
  leaderCreateAnnouncement,
  leaderUpdateAnnouncement,
  leaderDeleteAnnouncement,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from '../../services/announcements';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Read Hooks
// ---------------------------------------------------------------------------

export function useAnnouncementsQuery(search = '') {
  const userId = useUserId();
  const q = search.trim();
  return useQuery({
    queryKey: queryKeys.announcements(userId, q),
    queryFn: () => listAnnouncements(q),
  });
}

export function useAnnouncementDetailQuery(id: string, options?: { enabled?: boolean }) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.announcementDetail(userId, id),
    queryFn: () => getAnnouncement(id),
    enabled: options?.enabled ?? true,
  });
}

export function useLeaderAnnouncementsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.leaderAnnouncements(userId),
    queryFn: leaderListAnnouncements,
  });
}

// ---------------------------------------------------------------------------
// Mutations — invalidate the shared announcements tree after success
// ---------------------------------------------------------------------------

function useInvalidateAnnouncements() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ['announcements', userId ?? 'anon'] });
}

export function useCreateAnnouncementMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) =>
      leaderCreateAnnouncement(input, userId),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateAnnouncementMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (v: { id: string; input: UpdateAnnouncementInput }) =>
      leaderUpdateAnnouncement(v.id, v.input, userId),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAnnouncementMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateAnnouncements();
  return useMutation({
    mutationFn: (id: string) => leaderDeleteAnnouncement(id, userId),
    onSuccess: () => invalidate(),
  });
}

// ---------------------------------------------------------------------------
// Background Prefetcher
// ---------------------------------------------------------------------------
let warmedThisSession = false;

export async function warmAnnouncementDetailCache(
  qc: ReturnType<typeof useQueryClient>,
  userId: string | null,
  announcementIds: string[],
): Promise<void> {
  if (warmedThisSession || !announcementIds.length) return;
  warmedThisSession = true;

  const missing = announcementIds.filter(
    (id) => qc.getQueryData(queryKeys.announcementDetail(userId, id)) === undefined,
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
            queryKey: queryKeys.announcementDetail(userId, id),
            queryFn: () => getAnnouncement(id),
          });
        } catch {
          // skip
        }
      }),
    );
    if (i + CONCURRENCY < missing.length) {
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  }
}