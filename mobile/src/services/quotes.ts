import { apiGet, http } from './api';
import { queryClient } from './queryClient';

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
  const res = await apiGet<{ item: DailyQuote | null }>('/quotes/today');
  return res.item;
}

export async function listRecentQuotes(days = 7): Promise<DailyQuote[]> {
  const res = await apiGet<{ items: DailyQuote[] }>(`/quotes/recent?days=${days}`);
  return res.items;
}

export async function getMyQuoteCount(): Promise<number> {
  const res = await apiGet<{ count: number }>('/quotes/mine/count');
  return res.count;
}

export async function publishTodayQuote(
  input: PublishQuoteInput,
  userId: string | null,
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

  // Invalidate TanStack cache for all quote queries
  await queryClient.invalidateQueries({
    queryKey: ['quotes', userId ?? 'anon'],
  });

  return res.data.quote;
}