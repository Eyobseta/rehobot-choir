import { useQuery } from '@tanstack/react-query';
import { me } from '../../services/auth';
import { listEvents } from '../../services/events';
import { listAnnouncements } from '../../services/announcements';
import { listBirthdays } from '../../services/birthdays';
import { listNotifications } from '../../services/notifications';
import { getTodayQuote } from '../../services/quotes';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession'; // decode user id from token

/**
 * All Home GETs, expressed as TanStack queries.
 *
 * Behavior contract:
 *   - Cached data renders immediately (data !== undefined) even if stale.
 *   - Background revalidation runs on mount, on app focus, on reconnect.
 *   - `isPending` is only true on the very first load with no cache.
 *   - `isFetching` is true during any background refresh (drives the subtle
 *     "refreshing" indicator on Home).
 *   - `isError && data` means "showing saved data".
 *
 * The hooks do NOT mutate any state, so refetching is safe at any time.
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
    // `me()` gives us `mustChangePassword` and the canonical user id.
    // Refetching it on every focus is cheap and expected.
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
    // NOTE: uses `services/birthdays.ts`'s cached variant, NOT the plain
    // apiGet in members.ts. Both endpoints are identical; the difference
    // is that this one is shared with the BirthdayDetail flow.
    queryFn: listBirthdays,
  });
}

// ---------- notifications (Home preview) ----------
export function useNotificationsPreviewQuery(limit = 5) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.notifications(userId, limit),
    queryFn: () => listNotifications(limit),
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