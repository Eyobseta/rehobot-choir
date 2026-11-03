/**
 * User-scoped query keys.
 *
 * Every key starts with ['<domain>', userId, ...]. Including the userId in the
 * key guarantees that User A's cached data can never be returned to User B on
 * a shared device — even before logout clears the store.
 */
export const queryKeys = {
  profileMe: (userId: string | null) => ['profile', userId ?? 'anon', 'me'] as const,

  events: (userId: string | null, scope: 'upcoming' | 'past') =>
    ['events', userId ?? 'anon', scope] as const,

  announcements: (userId: string | null, search = '') =>
    ['announcements', userId ?? 'anon', 'list', search] as const,

  birthdays: (userId: string | null) =>
    ['birthdays', userId ?? 'anon', 'list'] as const,

  /**
   * One canonical notifications list key. `limit` is NOT part of the key.
   * Home's preview and the Notifications screen share the same entry; each
   * slices what it needs via `select`.
   */
  notifications: (userId: string | null) =>
    ['notifications', userId ?? 'anon', 'list'] as const,

  quoteToday: (userId: string | null) =>
    ['quotes', userId ?? 'anon', 'today'] as const,

  directory: (userId: string | null, search = '') =>
    ['directory', userId ?? 'anon', 'list', search] as const,

  member: (userId: string | null, memberId: string) =>
    ['member', userId ?? 'anon', 'detail', memberId] as const,
} as const;