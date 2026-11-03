import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setUnread } from '../../services/unreadStore';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';
import type { NotificationItem } from '../../services/notifications';

/**
 * Single source of truth for the unread badge.
 *
 * Reads the FULL notifications list from the TanStack cache (Home only
 * renders a 5-item preview but the query itself fetches 60), so the badge
 * on Home and the unread count on the Notifications screen cannot diverge.
 *
 * `items` is the preview slice passed by Home (`useHomeUnreadSync(notifQ.data)`).
 * It is a dependency of the effect so the badge is recomputed when the query
 * first resolves — otherwise the effect fires once with an empty cache, returns
 * early, and never runs again (badge stuck at 0 until Notifications is opened).
 *
 * NotificationsScreen calls it with no argument and only needs the cache read,
 * so `items` being undefined there is fine.
 */
export function useHomeUnreadSync(items?: NotificationItem[]): void {
  const userId = useMe()?.id ?? null;
  const qc = useQueryClient();

  useEffect(() => {
    const data =
      qc.getQueryData<NotificationItem[]>(queryKeys.notifications(userId)) ??
      items;
    if (!data) return;
    setUnread(data.reduce((n, x) => (x.readAt ? n : n + 1), 0));
  }, [qc, userId, items]);
}