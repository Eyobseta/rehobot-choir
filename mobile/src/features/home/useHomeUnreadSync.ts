import { useEffect } from 'react';
import { setUnread } from '../../services/unreadStore';
import type { NotificationItem } from '../../services/notifications';

/**
 * Single source of truth for the unread badge.
 *
 * Every screen that renders a notifications list — today Home; tomorrow
 * NotificationsScreen — should call this with the SAME query data (they
 * share `['notifications', userId, 'list', limit]` via the query key
 * factory). That way, there is exactly one unread count in the app.
 *
 * The effect is a no-op when `items` is undefined (no cache yet).
 */
export function useHomeUnreadSync(items: NotificationItem[] | undefined): void {
  useEffect(() => {
    if (!items) return;
    const unread = items.reduce((n, x) => (x.readAt ? n : n + 1), 0);
    setUnread(unread);
  }, [items]);
}