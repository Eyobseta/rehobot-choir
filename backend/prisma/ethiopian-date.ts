// prisma/ethiopian-date.ts
// Ethiopian <-> Gregorian helpers.
// Policy: all Date arguments/returns represent a DATE ONLY at UTC midnight.
// Never pass `new Date()` (which has a time); use todayEthiopian() instead.

export type EthDate = { year: number; month: number; day: number };

const ETHIOPIC_EPOCH_OFFSET = 1723856; // JDN of 1 Meskerem 1 E.C.

export const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
] as const;

function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

function jdnToGregorian(jdn: number) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

/** Convert a UTC-midnight Date to an Ethiopian date. */
export function toEthiopian(date: Date): EthDate {
  const jdn = gregorianToJDN(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  const r = jdn - ETHIOPIC_EPOCH_OFFSET;
  const n = r % 1461;
  const year = 4 * Math.floor(r / 1461) + Math.floor(n / 365);
  const dayOfYear = n % 365;
  const month = Math.floor(dayOfYear / 30) + 1;
  const day = (dayOfYear % 30) + 1;
  return { year, month, day };
}

/** Convert an Ethiopian date to a UTC-midnight Date. */
export function fromEthiopian({ year, month, day }: EthDate): Date {
  const jdn =
    ETHIOPIC_EPOCH_OFFSET +
    (year - 1) * 365 +
    Math.floor(year / 4) +
    (month - 1) * 30 +
    day;
  const g = jdnToGregorian(jdn);
  return new Date(Date.UTC(g.year, g.month - 1, g.day, 0, 0, 0, 0));
}

/**
 * Today in Ethiopian calendar, derived from the LOCAL system date.
 * Use this instead of `toEthiopian(new Date())`.
 */
export function todayEthiopian(now: Date = new Date()): EthDate {
  const localMidnightUTC = new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0,
  ));
  return toEthiopian(localMidnightUTC);
}

/** Add N days to an E.C. date. */
export function addDaysEth(eth: EthDate, days: number): EthDate {
  const g = fromEthiopian(eth);
  g.setUTCDate(g.getUTCDate() + days);
  return toEthiopian(g);
}

/**
 * Subtract exactly one Ethiopian month (SRS: deadline = expiry - 1 month).
 * If the target month has no matching day, use the last day of that month.
 * Ethiopian months are always 30 days except Pagume (5 or 6 in leap years).
 */
export function subtractOneEthMonth({ year, month, day }: EthDate): EthDate {
  let m = month - 1;
  let y = year;
  if (m === 0) { m = 13; y -= 1; }

  const maxDay = m === 13
    ? (isEthiopianLeap(y) ? 6 : 5)
    : 30;
  return { year: y, month: m, day: Math.min(day, maxDay) };
}

/** Ethiopian leap year: year % 4 === 3. */
export function isEthiopianLeap(year: number): boolean {
  return year % 4 === 3;
}

/** Format for UI: "Meskerem 5, 2019 E.C." */
export function formatEth(eth: EthDate): string {
  return `${ETHIOPIAN_MONTHS[eth.month - 1]} ${eth.day}, ${eth.year} E.C.`;
}