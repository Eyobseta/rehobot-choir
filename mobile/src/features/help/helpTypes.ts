export type HelpRole = 'MEMBER' | 'LEADER' | 'ADMIN';
export type HelpLanguage = 'en' | 'am';

export type HelpDeepLinkKey =
  | 'HOME'
  | 'SONGS'
  | 'MEMORIES'
  | 'CHAT'
  | 'PROFILE'
  | 'FUNDING';

export type HelpEntry = {
  id: string;
  slug: string;
  category: string;
  intentsEn: string[];
  intentsAm: string[];
  questionVariantsEn: string[];
  questionVariantsAm: string[];
  answerEn: string;
  answerAm: string;
  deepLink: HelpDeepLinkKey | null;
  visibleToRoles: string[];
  screenHints: string[];
};

export type HelpMessageModel = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  matchedEntryId?: string | null;
  matchScore?: number | null;
  logId?: string | null;
  deepLink?: HelpDeepLinkKey | null;
  feedback?: 'UP' | 'DOWN' | null;
  createdAt: number;
};