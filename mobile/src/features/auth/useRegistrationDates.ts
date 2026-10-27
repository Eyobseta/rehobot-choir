import { useMemo } from 'react';
import { EthDate } from '../../utils/ethiopianCalendar';
import {
  getRegistrationToday,
  defaultPickerValue,
  formatRegistrationDate,
  isDobInRange,
  isJoiningDateInRange,
  registrationPickerBounds,
} from './registrationDates';

/**
 * One-stop hook for registration date state.
 *
 * `today` is computed once on mount so picker min/max bounds and
 * "opens on today" defaults stay consistent for the whole screen
 * session. (Recomputing per render would only matter across midnight.)
 */
export function useRegistrationDates() {
  const today = useMemo<EthDate>(() => getRegistrationToday(), []);

  const bounds = useMemo(() => registrationPickerBounds(today), [today]);

  return {
    today,
    bounds,
    defaultPickerValue: () => defaultPickerValue(today),
    format: formatRegistrationDate,
    isDobInRange: (dob: EthDate) => isDobInRange(dob, today),
    isJoiningDateInRange: (j?: EthDate | null) => isJoiningDateInRange(j, today),
  };
}