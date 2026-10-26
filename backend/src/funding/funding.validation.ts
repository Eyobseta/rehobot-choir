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

export function reqEthDate(v: unknown, field: string): EthDate {
  // multipart/form-data sends body fields as strings, so try to parse first.
  let parsed: unknown = v;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw ApiError.badRequest(`${field} is required.`);
    }
  }

  const o = parsed as Partial<EthDate> | null;
  if (!o || typeof o !== 'object') throw ApiError.badRequest(`${field} is required.`);
  const d = { year: Number(o.year), month: Number(o.month), day: Number(o.day) };
  if (!isValidEthDate(d)) {
    throw ApiError.badRequest(`${field} is not a valid Ethiopian calendar date.`, 'INVALID_ETHIOPIAN_DATE');
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