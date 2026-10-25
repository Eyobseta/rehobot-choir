import { EthDate, formatEthDate } from './ethiopianCalendar';

/**
 * Converts an API date DTO (which includes the iso string and eth parts)
 * into a human-readable string for the UI.
 */
export function formatApiDate(apiDate: any): string {
  if (!apiDate) return '';
  
  // The backend sends { iso, eth, labelEn, labelAm }
  if (apiDate.eth) {
    // Return the Amharic or English label depending on app language
    return apiDate.labelEn; // Hardcoded to English for now, will hook up to i18n later
  }
  
  return apiDate.iso;
}

/**
 * Converts a JS Date into an Ethiopian Date object.
 * Used if we need to default a date picker to "today".
 */
export function getTodayEth(): EthDate {
  const today = new Date();
  return {
    year: today.getFullYear() - 8, // Rough approximation: 2023 G.C. is ~2015 E.C.
    month: 1, // Fallback
    day: 1,
  };
}