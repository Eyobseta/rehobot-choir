import i18n from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { HelpLanguage } from './helpTypes';

export const helpEn = {
  fabLabel: 'Help',
  title: 'Rehobot Help',
  subtitle: 'Ask me anything about the app',
  inputPlaceholder: 'Ask a question…',
  send: 'Send',
  close: 'Close',
  thinking: 'Thinking…',
  emptyTitle: 'How can I help?',
  emptyHint: 'Try one of these, or type your question.',
  suggestion1: 'Where is Funding?',
  suggestion2: 'How do I pay my contribution?',
  suggestion3: 'How do I submit a song?',
  suggestion4: 'How do I change my password?',
  suggestion5: 'How do I RSVP to an event?',
  fallbackTitle: "I couldn't find that",
  fallbackBody: 'Try rephrasing, or pick a topic:',
  fallbackContact: 'For anything else, contact a choir leader.',
  openAction: 'Open',
  feedbackHelpful: 'Was this helpful?',
  feedbackThanks: 'Thanks for the feedback.',
  offline: 'You are offline. I can answer common questions from the saved help.',
  retry: 'Retry',
};

export const helpAm: typeof helpEn = {
  fabLabel: 'እርዳታ',
  title: 'የርሆቦት እርዳታ',
  subtitle: 'ስለ መተግበሪያው ማንኛውንም ይጠይቁ',
  inputPlaceholder: 'ጥያቄ ይጻፉ…',
  send: 'ላክ',
  close: 'ዝጋ',
  thinking: 'በማሰብ ላይ…',
  emptyTitle: 'እንዴት ልርዳዎት?',
  emptyHint: 'ከእነዚህ ይሞክሩ ወይም ጥያቄዎን ይጻፉ።',
  suggestion1: 'Funding የሚገኘው የት ነው?',
  suggestion2: 'መዋጮዬን እንዴት እከፍላለሁ?',
  suggestion3: 'መዝሙር እንዴት አስገባለሁ?',
  suggestion4: 'የይለፍ ቃሌን እንዴት እቀይራለሁ?',
  suggestion5: 'ለክስተት እንዴት RSVP አደርጋለሁ?',
  fallbackTitle: 'ያንን ማግኘት አልቻልኩም',
  fallbackBody: 'እንደገና ይቅረጹ ወይም ርዕስ ይምረጡ፦',
  fallbackContact: 'ለሌላ ነገር አንድ የመዘምራን መሪ ያግኙ።',
  openAction: 'ክፈት',
  feedbackHelpful: 'ይህ ጠቃሚ ነበር?',
  feedbackThanks: 'ስለ አስተያየትዎ እናመሰግናለን።',
  offline: 'ከመስመር ውጭ ነዎት። ከተቀመጠው እርዳታ የተለመዱ ጥያቄዎችን መመለስ እችላለሁ።',
  retry: 'እንደገና ሞክር',
};

let registered = false;
export function ensureHelpStrings(): void {
  if (registered || !i18n.isInitialized) return;
  i18n.addResourceBundle('en', 'translation', { help: helpEn }, true, true);
  i18n.addResourceBundle('am', 'translation', { help: helpAm }, true, true);
  registered = true;
}

export type HelpTrKey = keyof typeof helpEn;
export type HelpTr = (key: HelpTrKey) => string;

export function useHelpTr(): HelpTr {
  const { t } = useTranslation();
  ensureHelpStrings();
  return useCallback(
    (key) => t(`help.${key}`, { defaultValue: helpEn[key] }) as string,
    [t],
  );
}

export function pickLanguage(i18nLang: string | undefined): HelpLanguage {
  return i18nLang?.startsWith('am') ? 'am' : 'en';
}