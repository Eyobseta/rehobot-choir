import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTodayQuote,
  listRecentQuotes,
  publishTodayQuote,
  PublishQuoteInput,
} from '../../services/quotes';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

export function useRecentQuotesQuery(days = 7) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.quotesRecent(userId, days),
    queryFn: () => listRecentQuotes(days),
  });
}

export function usePublishQuoteMutation() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishQuoteInput) => publishTodayQuote(input, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes', userId ?? 'anon'] });
    },
  });
}