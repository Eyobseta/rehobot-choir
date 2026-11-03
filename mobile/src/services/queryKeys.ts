/**
 * User-scoped query keys.
 *
 * Every key starts with ['<domain>', userId, ...]. Including the userId in the
 * key is what guarantees that User A's cached data can never be returned to
 * User B on a shared device — even before logout clears the store.
 *
 * If `userId` is null (not yet signed in / restoring), keys use 'anon'. That
 * branch is never used by member screens because those screens only mount
 * after authentication.
 */
export const queryKeys = {
  profileMe: (userId: string | null) => ['profile', userId ?? 'anon', 'me'] as const,

  events: (userId: string | null, scope: 'upcoming' | 'past') =>
    ['events', userId ?? 'anon', scope] as const,

  announcements: (userId: string | null, search = '') =>
    ['announcements', userId ?? 'anon', 'list', search] as const,

  birthdays: (userId: string | null) =>
    ['birthdays', userId ?? 'anon', 'list'] as const,

  notifications: (userId: string | null, limit: number) =>
    ['notifications', userId ?? 'anon', 'list', limit] as const,

  quoteToday: (userId: string | null) =>
    ['quotes', userId ?? 'anon', 'today'] as const,
} as const;