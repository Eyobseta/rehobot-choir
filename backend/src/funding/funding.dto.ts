import {
  EthDate, utcDateToEth, formatEthDate, endOfDayAddis,
} from '../utils/ethiopianCalendar';
import { formatEtb } from '../utils/money';

/** A date-only value as the API returns it: Ethiopian parts + labels + normalised ISO day. */
export function dateDto(d: Date) {
  const eth = utcDateToEth(d);
  return {
    iso: d.toISOString().slice(0, 10),
    eth,
    labelEn: formatEthDate(eth, 'en'),
    labelAm: formatEthDate(eth, 'am'),
  };
}

export function ethDto(eth: EthDate) {
  return { eth, labelEn: formatEthDate(eth, 'en'), labelAm: formatEthDate(eth, 'am') };
}

export function moneyDto(minor: number) {
  return { minor, label: formatEtb(minor) };
}

export function isPastDeadline(deadlineDate: Date, now = new Date()): boolean {
  return now.getTime() > endOfDayAddis(deadlineDate).getTime();
}

export function declarationDto(d: {
  id: string; 
  amountMinor: number; 
  reference: string | null; 
  paymentMethod: string | null;
  status: string;
  declaredAt: Date; 
  decidedAt: Date | null; 
  rejectionReason: string | null;
}) {
  return {
    id: d.id,
    amount: moneyDto(d.amountMinor),
    reference: d.reference,
    paymentMethod: d.paymentMethod,
    status: d.status,
    declaredAt: d.declaredAt,
    decidedAt: d.decidedAt,
    rejectionReason: d.rejectionReason,
  };
}

/**
 * v2 progress bar. `target` null = open-amount (no percentage).
 * Integer math only. `paid` is VERIFIED money only.
 */
export function progressDto(paidMinor: number, targetMinor: number | null) {
  const paid = Math.max(0, paidMinor);
  if (!targetMinor || targetMinor <= 0) {
    return { paid: moneyDto(paid), target: null, remaining: null, percent: null as number | null };
  }
  return {
    paid: moneyDto(paid),
    target: moneyDto(targetMinor),
    remaining: moneyDto(Math.max(0, targetMinor - paid)),
    percent: Math.min(100, Math.floor((paid * 100) / targetMinor)) as number | null,
  };
}