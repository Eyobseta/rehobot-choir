/**
 * Registration-specific date helpers.
 *
 * Kept separate from src/utils/dateFormatter.ts on purpose:
 *  - dateFormatter is shared and consumed widely; we don't touch it here.
 *  - Registration only needs: "today" in E.C. + display + picker bounds.
 *
 * All real conversion logic lives in utils/ethiopianCalendar.ts.
 */

import {
  EthDate,
  ethTodayFromInstant,
  formatEthDate,
  isValidEthDate,
  compareEth,
} from '../../utils/ethiopianCalendar';

/** Earliest plausible year of birth we allow in the picker. */
export const REGISTRATION_MIN_YEAR = 1950;

/**
 * Today's date in the Ethiopian calendar, in the Addis Ababa timezone.
 * This is the ONLY correct source of "today" for the registration pickers.
 */
export function getRegistrationToday(now: Date = new Date()): EthDate {
  return ethTodayFromInstant(now);
}

/**
 * Default starting value for a picker when the field is still empty.
 * DOB and Joining Date both open on today.
 */
export function defaultPickerValue(today: EthDate): EthDate {
  return today;
}

/**
 * Display an EthDate for the registration review screen.
 */
export function formatRegistrationDate(eth: EthDate | null | undefined): string {
  if (!eth || !isValidEthDate(eth)) return '';
  return formatEthDate(eth);
}

/**
 * Validation helpers specific to the registration flow.
 * Kept here so the screen stays declarative and these are unit-testable.
 */

/** DOB must be on or before today (no future birthdays). */
export function isDobInRange(dob: EthDate, today: EthDate): boolean {
  if (!isValidEthDate(dob)) return false;
  if (dob.year < REGISTRATION_MIN_YEAR) return false;
  return compareEth(dob, today) <= 0;
}

/** Joining date is optional; if present, it must be on or before today. */
export function isJoiningDateInRange(
  joining: EthDate | null | undefined,
  today: EthDate,
): boolean {
  if (!joining) return true; // optional
  if (!isValidEthDate(joining)) return false;
  if (joining.year < REGISTRATION_MIN_YEAR) return false;
  return compareEth(joining, today) <= 0;
}

/** Picker bounds shared by both fields. */
export function registrationPickerBounds(today: EthDate): {
  minYear: number;
  maxYear: number;
} {
  return { minYear: REGISTRATION_MIN_YEAR, maxYear: today.year };
}