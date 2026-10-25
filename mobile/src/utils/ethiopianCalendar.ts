/**
 * Ethiopian calendar utilities (Amete Mihret era).
 */

export type EthDate = { year: number; month: number; day: number };

export const ETH_MONTHS_EN = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
] as const;

export const ETH_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን',
] as const;

const JDN_OFFSET = 1723856;
const ADDIS_OFFSET_HOURS = 3;

export function isEthLeapYear(year: number): boolean {
  return ((year % 4) + 4) % 4 === 3;
}

export function daysInEthMonth(year: number, month: number): number {
  if (month < 1 || month > 13) throw new RangeError(`Invalid Ethiopian month: ${month}`);
  if (month <= 12) return 30;
  return isEthLeapYear(year) ? 6 : 5;
}

export function isValidEthDate(d: EthDate): boolean {
  const { year, month, day } = d;
  if (![year, month, day].every(Number.isInteger)) return false;
  if (year < 1 || year > 9999) return false;
  if (month < 1 || month > 13) return false;
  return day >= 1 && day <= daysInEthMonth(year, month);
}

function ethToJdn({ year, month, day }: EthDate): number {
  return JDN_OFFSET + 365 + 365 * (year - 1) + Math.floor(year / 4) + 30 * month + day - 31;
}

function jdnToEth(jdn: number): EthDate {
  const r = (jdn - JDN_OFFSET) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - JDN_OFFSET) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}

function gregToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

export function gregorianToEthiopian(y: number, m: number, d: number): EthDate {
  return jdnToEth(gregToJdn(y, m, d));
}

export function ethiopianToGregorian(e: EthDate): { year: number; month: number; day: number } {
  if (!isValidEthDate(e)) throw new RangeError(`Invalid Ethiopian date: ${JSON.stringify(e)}`);
  const j = ethToJdn(e) + 0;
  const f = j + 1401 + Math.floor((Math.floor((4 * j + 274277) / 146097) * 3) / 4) - 38;
  const ee = 4 * f + 3;
  const g = Math.floor((ee % 1461) / 4);
  const h = 5 * g + 2;
  const day = Math.floor((h % 153) / 5) + 1;
  const month = ((Math.floor(h / 153) + 2) % 12) + 1;
  const year = Math.floor(ee / 1461) - 4716 + Math.floor((12 + 2 - month) / 12);
  return { year, month, day };
}

export function ethToUtcDate(e: EthDate): Date {
  const g = ethiopianToGregorian(e);
  return new Date(Date.UTC(g.year, g.month - 1, g.day));
}

export function utcDateToEth(date: Date): EthDate {
  return gregorianToEthiopian(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function ethTodayFromInstant(now: Date): EthDate {
  const addis = new Date(now.getTime() + ADDIS_OFFSET_HOURS * 3600_000);
  return gregorianToEthiopian(addis.getUTCFullYear(), addis.getUTCMonth() + 1, addis.getUTCDate());
}

export function endOfDayAddis(dateOnlyUtc: Date): Date {
  return new Date(
    Date.UTC(dateOnlyUtc.getUTCFullYear(), dateOnlyUtc.getUTCMonth(), dateOnlyUtc.getUTCDate(), 23, 59, 59, 999) -
      ADDIS_OFFSET_HOURS * 3600_000,
  );
}

export function compareEth(a: EthDate, b: EthDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function addEthDays(e: EthDate, days: number): EthDate {
  return jdnToEth(ethToJdn(e) + days);
}

export function ethDaysBetween(a: EthDate, b: EthDate): number {
  return ethToJdn(b) - ethToJdn(a);
}

export function subtractOneEthMonth(expiry: EthDate): EthDate {
  if (!isValidEthDate(expiry)) throw new RangeError(`Invalid Ethiopian date: ${JSON.stringify(expiry)}`);
  let year = expiry.year;
  let month = expiry.month - 1;
  if (month < 1) {
    month = 13;
    year -= 1;
  }
  const day = Math.min(expiry.day, daysInEthMonth(year, month));
  return { year, month, day };
}

export const calculateAnnualDeadline = subtractOneEthMonth;

export function formatEthDate(e: EthDate, lang: 'en' | 'am' = 'en'): string {
  const name = (lang === 'am' ? ETH_MONTHS_AM : ETH_MONTHS_EN)[e.month - 1];
  return lang === 'am' ? `${name} ${e.day}፣ ${e.year} ዓ.ም` : `${name} ${e.day}, ${e.year} E.C.`;
}

/** Today in Ethiopian calendar, derived from the LOCAL system date. */
export function todayEthiopian(now: Date = new Date()): EthDate {
  const localMidnightUTC = new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0,
  ));
  return utcDateToEth(localMidnightUTC);
}