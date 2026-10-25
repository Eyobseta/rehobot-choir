import { apiGet, http } from './api';
import { cachedFetch, cacheInvalidatePrefix } from './cache';
import { CACHE_KEYS, CACHE_PREFIXES } from './cacheKeys';
import { EthDate } from '../utils/ethiopianCalendar';

export type DailyQuote = {
  id: string;
  dateOnly: string;
  quoteText: string;
  source: string;
  youtubeUrl: string | null;
  audioUrl: string | null;
  createdAt: string;
  submittedBy?: {
    id: string;
    memberProfile: { fullName: string; profilePhotoUrl: string | null } | null;
  } | null;
};

export type PublishQuoteInput = {
  quoteText: string;
  source: string;
  youtubeUrl?: string;
  audioUri?: string | null;
  audioName?: string | null;
  audioMime?: string | null;
};

export async function getTodayQuote(): Promise<DailyQuote | null> {
  const cached = await cachedFetch<DailyQuote | null>(
    CACHE_KEYS.quoteToday,
    async () => {
      const res = await apiGet<{ item: DailyQuote | null }>('/quotes/today');
      return res.item;
    },
    () => {},
  );
  return cached ?? null;
}

export async function listRecentQuotes(days = 7): Promise<DailyQuote[]> {
  const cached = await cachedFetch<DailyQuote[]>(
    CACHE_KEYS.quotesRecent(days),
    async () => {
      const res = await apiGet<{ items: DailyQuote[] }>(`/quotes/recent?days=${days}`);
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

export async function getMyQuoteCount(): Promise<number> {
  const res = await apiGet<{ count: number }>('/quotes/mine/count');
  return res.count;
}

export async function publishTodayQuote(
  input: PublishQuoteInput,
): Promise<DailyQuote> {
  const form = new FormData();
  form.append('quoteText', input.quoteText);
  form.append('source', input.source);
  if (input.youtubeUrl) form.append('youtubeUrl', input.youtubeUrl);

  if (input.audioUri) {
    // @ts-expect-error — RN FormData
    form.append('audio', {
      uri: input.audioUri,
      name: input.audioName ?? 'audio.m4a',
      type: input.audioMime ?? 'audio/m4a',
    });
  }

  const res = await http.post<{ quote: DailyQuote }>('/quotes', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90_000,
    transformRequest: (d) => d,
  });

  await cacheInvalidatePrefix(CACHE_PREFIXES.quote);
  return res.data.quote;
}