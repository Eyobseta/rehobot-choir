import { PaymentMethod } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { EthDate, isValidEthDate } from '../utils/ethiopianCalendar';

export function reqString(v: unknown, field: string, min: number, max: number): string {
  if (typeof v !== 'string') throw ApiError.badRequest(`${field} is required.`);
  const s = v.trim();
  if (s.length < min) throw ApiError.badRequest(`${field} must be at least ${min} characters.`);
  if (s.length > max) throw ApiError.badRequest(`${field} must be at most ${max} characters.`);
  return s;
}

export function optString(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw ApiError.badRequest(`${field} must be text.`);
  const s = v.trim();
  if (s.length > max) throw ApiError.badRequest(`${field} must be at most ${max} characters.`);
  return s || null;
}

export function reqInt(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw ApiError.badRequest(`${field} must be a whole number between ${min} and ${max}.`);
  }
  return v;
}

export function optInt(v: unknown, field: string, min: number, max: number): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw ApiError.badRequest(`${field} must be a whole number between ${min} and ${max}.`);
  }
  return v;
}

export function optBool(v: unknown, field: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw ApiError.badRequest(`${field} must be true or false.`);
  return v;
}

/**
 * Ethiopian date validator.
 *
 * Accepts:
 *   - JSON object string:  '{"year":2016,"month":1,"day":1}'
 *   - Plain object:         { year: 2016, month: 1, day: 1 }
 *
 * Returns the parsed { year, month, day }, or throws an ApiError with one of:
 *   - DATE_REQUIRED          — missing / null / empty string
 *   - INVALID_DATE_FORMAT    — string that isn't a JSON object, or a non-object value
 *   - INVALID_ETHIOPIAN_DATE — parses as an object but isn't a real Ethiopian date
 *
 * Deliberately does NOT accept a bare "YYYY-MM-DD" string: the server cannot
 * tell whether the caller means Ethiopian or Gregorian parts, so accepting it
 * silently would risk storing a Gregorian date in an Ethiopian column.
 */
export function reqEthDate(v: unknown, field: string): EthDate {
  if (v === undefined || v === null || v === '') {
    throw ApiError.badRequest(`${field} is required.`, 'DATE_REQUIRED');
  }

  let parsed: unknown = v;

  if (typeof parsed === 'string') {
    const s = parsed.trim();
    if (!s) throw ApiError.badRequest(`${field} is required.`, 'DATE_REQUIRED');
    try {
      parsed = JSON.parse(s);
    } catch {
      throw ApiError.badRequest(
        `${field} must be a JSON object like {"year":2016,"month":1,"day":1}.`,
        'INVALID_DATE_FORMAT',
      );
    }
  }

  const o = parsed as Partial<EthDate> | null;
  if (!o || typeof o !== 'object') {
    throw ApiError.badRequest(
      `${field} must be an object with year, month, and day.`,
      'INVALID_DATE_FORMAT',
    );
  }

  const d = { year: Number(o.year), month: Number(o.month), day: Number(o.day) };
  if (!isValidEthDate(d)) {
    throw ApiError.badRequest(
      `${field} is not a valid Ethiopian calendar date.`,
      'INVALID_ETHIOPIAN_DATE',
    );
  }
  return d;
}

export function idParam(v: unknown): string {
  if (typeof v !== 'string' || !v || v.length > 64) throw ApiError.badRequest('Invalid id.');
  return v;
}

export function pageParams(q: Record<string, unknown>, maxSize = 50) {
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number(q.pageSize ?? 25) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** v2: the member must say how they paid. */
export function reqPaymentMethod(v: unknown): PaymentMethod {
  if (v === 'BANK') return PaymentMethod.BANK;
  if (v === 'TELEBIRR') return PaymentMethod.TELEBIRR;
  throw ApiError.badRequest('Select a payment method (Bank or Telebirr).', 'INVALID_PAYMENT_METHOD');
}

/** v2: declared/transferred amount in santim. 1 ETB .. 10,000,000 ETB. Integer only. */
export function reqAmountMinor(v: unknown, field = 'Amount'): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 100 || v > 1_000_000_000) {
    throw ApiError.badRequest(`${field} must be between 1 ETB and 10,000,000 ETB.`, 'INVALID_AMOUNT');
  }
  return v;
}

/** Optional version of reqEthDate (returns undefined if not provided). */
export function optEthDate(v: unknown, field: string): EthDate | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return reqEthDate(v, field);
}