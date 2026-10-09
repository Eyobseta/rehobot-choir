import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './en.json';
import am from './am.json';

export const LANGUAGE_KEY = '@rehobot/language';

export const SUPPORTED_LANGUAGES = ['en', 'am'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const resources = {
  en: { translation: en },
  am: { translation: am },
};

export async function initI18n(): Promise<void> {
  let savedLanguage: SupportedLanguage = DEFAULT_LANGUAGE;

  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      savedLanguage = stored as SupportedLanguage;
    }
  } catch {
    // Fall back to default if storage read fails
    savedLanguage = DEFAULT_LANGUAGE;
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: savedLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    // Non-fatal; language still changes in-memory
  }
}

export async function getCurrentLanguage(): Promise<SupportedLanguage> {
  const current = i18n.language as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(current) ? current : DEFAULT_LANGUAGE;
}

export default i18n;