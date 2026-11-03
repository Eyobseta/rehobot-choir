import { useQuery } from '@tanstack/react-query';
import { me } from '../../services/auth';
import { listEvents } from '../../services/events';
import { listAnnouncements } from '../../services/announcements';
import { listBirthdays } from '../../services/birthdays';
import { listNotifications } from '../../services/notifications';
import { getTodayQuote } from '../../services/quotes';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';
import { NOTIFICATIONS_PAGE_SIZE } from '../notifications/useNotifications';

/**
 * All Home GETs, expressed as TanStack queries.
 */

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------- me ----------
export function useMeQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.profileMe(userId),
    queryFn: me,
  });
}

// ---------- upcoming event ----------
export function useUpcomingEventQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.events(userId, 'upcoming'),
    queryFn: () => listEvents('upcoming'),
    select: (items) => items[0] ?? null,
  });
}

// ---------- recent announcements ----------
export function useRecentAnnouncementsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.announcements(userId, ''),
    queryFn: () => listAnnouncements(),
    select: (items) => items.slice(0, 3),
  });
}

// ---------- birthdays ----------
export function useBirthdaysQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.birthdays(userId),
    queryFn: listBirthdays,
  });
}

// ---------- notifications (Home preview) ----------
export function useNotificationsPreviewQuery(limit = 5) {
  const userId = useUserId();
  return useQuery({
    // SAME key as the Notifications screen — one cache entry shared.
    queryKey: queryKeys.notifications(userId),
    // Fetch the full list; `select` slices for Home.
    queryFn: () => listNotifications(NOTIFICATIONS_PAGE_SIZE),
    select: (items) => items.slice(0, limit),
  });
}

// ---------- today's quote (used by DailyQuoteCard) ----------
export function useTodayQuoteQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.quoteToday(userId),
    queryFn: getTodayQuote,
  });
}