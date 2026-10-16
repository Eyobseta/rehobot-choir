// prisma/ethiopian-date.ts
export type EthDate = { year: number; month: number; day: number };

const ETHIOPIC_EPOCH_OFFSET = 1723856; // JDN of 1 Meskerem 1 E.C.

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

/** Convert a JS Date (in UTC) to an Ethiopian date. */
export function toEthiopian(date: Date): EthDate {
  const jdn = gregorianToJDN(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  const r = jdn - ETHIOPIC_EPOCH_OFFSET;
  const n = r % 1461; // 4-year cycle
  const year = 4 * Math.floor(r / 1461) + Math.floor(n / 365);
  const dayOfYear = n % 365;
  const month = Math.floor(dayOfYear / 30) + 1;
  const day = (dayOfYear % 30) + 1;
  return { year, month, day };
}

/** Convert an Ethiopian date to a JS Date at UTC midnight. */
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

/** Convenience: today in Ethiopian calendar. */
export function todayEthiopian(): EthDate {
  return toEthiopian(new Date());
}

/** Add N days to an Ethiopian date. */
export function addDaysEth(eth: EthDate, days: number): EthDate {
  const g = fromEthiopian(eth);
  g.setUTCDate(g.getUTCDate() + days);
  return toEthiopian(g);
}