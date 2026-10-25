/**
 * ETB money helpers. All amounts are integer santim (1 ETB = 100 santim).
 * Never use floating-point arithmetic for money.
 */

export const MINOR_PER_ETB = 100;
/** Sanity ceiling for a single declared amount (10,000,000 ETB). Configurable on the server. */
export const DEFAULT_MAX_AMOUNT_MINOR = 10_000_000 * MINOR_PER_ETB;

/** "100", "100.5", "1,250.75" -> santim. Returns null if invalid (negative, >2 decimals, NaN, empty). */
export function parseEtbToMinor(input: string): number | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const minor = Number(whole) * MINOR_PER_ETB + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function isValidAmountMinor(minor: unknown, max = DEFAULT_MAX_AMOUNT_MINOR): minor is number {
  return typeof minor === 'number' && Number.isSafeInteger(minor) && minor > 0 && minor <= max;
}

/** santim -> "1,250.75 ETB" (drops ".00"). Integer math only. */
export function formatEtb(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / MINOR_PER_ETB);
  const frac = abs % MINOR_PER_ETB;
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${wholeStr}${frac ? '.' + String(frac).padStart(2, '0') : ''} ETB`;
}

/** Expected total = eligible count x per-person amount (exact integer math). */
export function expectedTotalMinor(eligibleCount: number, amountMinor: number): number {
  return eligibleCount * amountMinor;
}
