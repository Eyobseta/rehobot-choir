export const queryKeys = {
  profileMe: (userId: string | null) => ['profile', userId ?? 'anon', 'me'] as const,

  events: (userId: string | null, scope: 'upcoming' | 'past') =>
    ['events', userId ?? 'anon', scope] as const,

  announcements: (userId: string | null, search = '') =>
    ['announcements', userId ?? 'anon', 'list', search] as const,

  birthdays: (userId: string | null) =>
    ['birthdays', userId ?? 'anon', 'list'] as const,

  notifications: (userId: string | null) =>
    ['notifications', userId ?? 'anon', 'list'] as const,

  quoteToday: (userId: string | null) =>
    ['quotes', userId ?? 'anon', 'today'] as const,

  directory: (userId: string | null, search = '') =>
    ['directory', userId ?? 'anon', 'list', search] as const,

  member: (userId: string | null, memberId: string) =>
    ['member', userId ?? 'anon', 'detail', memberId] as const,

  // --- SONGS ---
  songsList: (userId: string | null, search = '') =>
    ['songs', userId ?? 'anon', 'list', search] as const,

  songDetail: (userId: string | null, id: string) =>
    ['songs', userId ?? 'anon', 'detail', id] as const,

  songCategories: (userId: string | null) =>
    ['songs', userId ?? 'anon', 'categories'] as const,

  songFavorites: (userId: string | null) =>
    ['songs', userId ?? 'anon', 'favorites'] as const,

  // --- MEMORIES ---
  memoriesList: (userId: string | null, search = '') =>
    ['memories', userId ?? 'anon', 'list', search] as const,

  memoryYears: (userId: string | null) =>
    ['memories', userId ?? 'anon', 'years'] as const,

  memoryDetail: (userId: string | null, id: string) =>
    ['memories', userId ?? 'anon', 'detail', id] as const,

  myMemories: (userId: string | null) =>
    ['memories', userId ?? 'anon', 'mine'] as const,
} as const;