export const queryKeys = {
  profileMe: (userId: string | null) => ['profile', userId ?? 'anon', 'me'] as const,

  events: (userId: string | null, scope: 'upcoming' | 'past') =>
    ['events', userId ?? 'anon', scope] as const,

  // NEW: single event detail, scoped per user
  eventDetail: (userId: string | null, id: string) =>
    ['events', userId ?? 'anon', 'detail', id] as const,

  // NEW: leader event list (uncached before, now cached per user)
  leaderEvents: (userId: string | null) =>
    ['events', userId ?? 'anon', 'leader', 'list'] as const,

  announcements: (userId: string | null, search = '') =>
    ['announcements', userId ?? 'anon', 'list', search] as const,

  // NEW: single announcement detail
  announcementDetail: (userId: string | null, id: string) =>
    ['announcements', userId ?? 'anon', 'detail', id] as const,

  // NEW: leader announcements list
  leaderAnnouncements: (userId: string | null) =>
    ['announcements', userId ?? 'anon', 'leader', 'list'] as const,

  birthdays: (userId: string | null) =>
    ['birthdays', userId ?? 'anon', 'list'] as const,

  // NEW: single birthday post detail
  birthdayPost: (userId: string | null, id: string) =>
    ['birthdays', userId ?? 'anon', 'detail', id] as const,

  notifications: (userId: string | null) =>
    ['notifications', userId ?? 'anon', 'list'] as const,

  quoteToday: (userId: string | null) =>
    ['quotes', userId ?? 'anon', 'today'] as const,

  // NEW: quotes history and detail
  quotesRecent: (userId: string | null, days: number) =>
    ['quotes', userId ?? 'anon', 'recent', days] as const,
    
  quoteDetail: (userId: string | null, id: string) =>
    ['quotes', userId ?? 'anon', 'detail', id] as const,

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


   // --- ATTENDANCE ---
  leaderAttendance: (userId: string | null, gathering: string, dateStr: string) =>
    ['attendance', userId ?? 'anon', 'leader', gathering, dateStr] as const,
  
  leaderAttendanceGrid: (userId: string | null, gathering: string, from: string, to: string) =>
    ['attendance', userId ?? 'anon', 'leader', 'grid', gathering, from, to] as const,
    
  myAttendance: (userId: string | null) =>
    ['attendance', userId ?? 'anon', 'me'] as const,
    
  myAttendanceGrid: (userId: string | null, from: string, to: string) =>
    ['attendance', userId ?? 'anon', 'me', 'grid', from, to] as const,
    
  memberAttendanceGrid: (userId: string | null, memberId: string, from: string, to: string) =>
    ['attendance', userId ?? 'anon', 'member', memberId, from, to] as const,
    
  attendanceMembers: (userId: string | null) =>
    ['attendance', userId ?? 'anon', 'members'] as const,

    // --- PROFILE ---
  ownProfile: (userId: string | null) =>
    ['profile', userId ?? 'anon', 'own'] as const,

  notificationPrefs: (userId: string | null) =>
    ['notifications', userId ?? 'anon', 'prefs'] as const,
} as const;