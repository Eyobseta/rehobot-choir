import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteNotification,
  listNotifications,
  markAllRead,
  markRead,
  type NotificationItem,
} from '../../services/notifications';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

/**
 * Fetch limit for the full notifications screen. Home uses the SAME query
 * key (with a `select` slice of 5) — see `useNotificationsPreviewQuery`.
 */
export const NOTIFICATIONS_PAGE_SIZE = 60;

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------
export function useNotificationsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: () => listNotifications(NOTIFICATIONS_PAGE_SIZE),
  });
}

// ---------------------------------------------------------------------------
// Mutations — invalidate the shared list after success. No optimistic updates.
// ---------------------------------------------------------------------------
function useInvalidate() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => markRead(id),
    onSuccess: () => invalidate(),
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteNotification() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => invalidate(),
  });
}

export function useUnreadNotifications(
  items: NotificationItem[] | undefined,
): NotificationItem[] {
  return (items ?? []).filter((n) => !n.readAt);
}