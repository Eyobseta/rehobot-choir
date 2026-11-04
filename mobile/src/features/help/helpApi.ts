import { apiGet, apiPost } from '../../services/api';
import type { HelpEntry, HelpLanguage } from './helpTypes';

export async function fetchHelpEntries(): Promise<HelpEntry[]> {
  const res = await apiGet<{ items: HelpEntry[] }>('/help/entries');
  return res.items;
}

export async function fetchHelpVersion(): Promise<string> {
  const res = await apiGet<{ version: string }>('/help/entries/version');
  return res.version;
}

export async function logHelpQuery(input: {
  screen?: string;
  language: HelpLanguage;
  rawQuery: string;
  matchedEntryId?: string | null;
  matchScore?: number | null;
}): Promise<string | null> {
  try {
    const res = await apiPost<{ id: string }>('/help/query-log', input);
    return res.id ?? null;
  } catch {
    return null;
  }
}

export async function sendHelpFeedback(
  queryId: string,
  feedback: 'UP' | 'DOWN' | 'NONE',
): Promise<void> {
  try {
    await apiPost(`/help/query-log/${queryId}/feedback`, { feedback });
  } catch {
    // silent
  }
}