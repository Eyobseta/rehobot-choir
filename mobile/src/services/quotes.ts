import { apiGet, http } from './api';
import { cachedFetch, cacheInvalidatePrefix, cacheRead, cacheWrite } from './cache';
import { CACHE_KEYS, CACHE_PREFIXES } from './cacheKeys';

export type DailyQuote = {
  id: string;
  dateEthYear: number;
  dateEthMonth: number;
  dateEthDay: number;
  dateGregorian: string;
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
  if (cached) {
    // Cache the individual quote too, so the detail screen can look it up by id.
    await cacheWrite(CACHE_KEYS.quoteDetail(cached.id), cached);
  }
  return cached ?? null;
}

export async function listRecentQuotes(days = 7): Promise<DailyQuote[]> {
  const key = CACHE_KEYS.quotesRecent(days);

  const cached = await cacheRead<DailyQuote[]>(key);

  const fetchFresh = async () => {
    const res = await apiGet<{ items: DailyQuote[] }>(`/quotes/recent?days=${days}`);
    await cacheWrite(key, res.items);
    // Cache each quote individually too.
    for (const q of res.items) {
      await cacheWrite(CACHE_KEYS.quoteDetail(q.id), q);
    }
    return res.items;
  };

  const items = cached ?? (await fetchFresh());

  // Even from cache, opportunistically populate the per-quote keys (cheap, once).
  for (const q of items) {
    const existing = await cacheRead<DailyQuote>(CACHE_KEYS.quoteDetail(q.id));
    if (!existing) await cacheWrite(CACHE_KEYS.quoteDetail(q.id), q);
  }

  return items;
}

/** Look up a single cached quote by id. Returns undefined if not cached. */
export async function getCachedQuoteById(id: string): Promise<DailyQuote | undefined> {
  return cacheRead<DailyQuote>(CACHE_KEYS.quoteDetail(id));
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
  // Seed the caches so the UI updates immediately without a refetch.
  await cacheWrite(CACHE_KEYS.quoteToday, res.data.quote);
  await cacheWrite(CACHE_KEYS.quoteDetail(res.data.quote.id), res.data.quote);
  return res.data.quote;
}