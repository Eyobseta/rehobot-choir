export const CACHE_KEYS = {
  // Profile & session
  meProfile: 'profile:me',
  memberDirectory: (search: string) => `directory:${search || '_all'}`,
  memberDetail: (id: string) => `member:${id}`,

  // Choir core
  eventsUpcoming: 'events:upcoming',
  eventsPast: 'events:past',
  eventDetail: (id: string) => `event:${id}`,

  announcementsList: (search: string) => `announcements:${search || '_all'}`,
  announcementDetail: (id: string) => `announcement:${id}`,

  // Songs
  songsList: (search: string) => `songs:${search || '_all'}`,
  songDetail: (id: string) => `song:${id}`,
  songCategories: 'songs:categories',
  songFavorites: 'songs:favorites',

  // Memories
  memoriesList: (search: string) => `memories:${search || '_all'}`,
  memoryYears: 'memories:years',
  memoryDetail: (id: string) => `memory:${id}`,

  // Birthdays & quotes
  birthdays: 'birthdays:list',
  birthdayPost: (id: string) => `birthday:post:${id}`,
  quoteToday: 'quote:today',
  quotesRecent: (days: number) => `quotes:recent:${days}`,
  quoteDetail: (id: string) => `quote:detail:${id}`,

  // Notifications
  notificationsList: 'notifications:list',
  notificationsPreferences: 'notifications:prefs',

  // Chats
  chatsList: 'chats:list',
  chatDetail: (id: string) => `chats:detail:${id}`,

  // Funding
  myFunding: 'funding:me',
  paymentInstructions: 'funding:instructions',
  campaignDetail: (id: string) => `funding:campaign:${id}`,
  leaderAnnualList: (status: string, q: string, page: number) =>
    `funding:leader:annual:${status}:${q}:${page}`,
  leaderCampaigns: 'funding:leader:campaigns',

  // Leader Tools (NEW)
  leaderApprovals: 'leader:approvals',
  leaderSongs: 'leader:songs',
  leaderCategories: 'leader:categories',
  leaderZema: 'leader:zema',
  leaderSubmissions: 'leader:submissions',
} as const;

export const CACHE_PREFIXES = {
  events: 'events:',
  announcements: 'announcements:',
  songs: 'songs:',
  memories: 'memories:',
  birthdays: 'birthdays:',
  birthday: 'birthday:',
  quote: 'quote:',
  notifications: 'notifications:',
  funding: 'funding:',
  directory: 'directory:',
  member: 'member:',
  profile: 'profile:',
  chats: 'chats:',
  leader: 'leader:', // NEW
} as const;