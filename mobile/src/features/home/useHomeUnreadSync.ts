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
 * The ignored argument is kept so existing callers
 * (`useHomeUnreadSync(notifQ.data)`) keep working without edits.
 */
export function useHomeUnreadSync(_itemsIgnored?: NotificationItem[]): void {
  const userId = useMe()?.id ?? null;
  const qc = useQueryClient();

  useEffect(() => {
    const data = qc.getQueryData<NotificationItem[]>(
      queryKeys.notifications(userId),
    );
    if (!data) return;
    setUnread(data.reduce((n, x) => (x.readAt ? n : n + 1), 0));
  }, [qc, userId]);
}