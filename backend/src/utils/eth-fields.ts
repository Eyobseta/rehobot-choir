import { EthDate, ethToUtcDate } from './ethiopianCalendar';

export function ethFields(eth: EthDate, prefix: 'date' | 'expiry' | 'deadline' | 'start' | 'dateOfBirth' | 'joiningDate' | 'birthday') {
  const g = ethToUtcDate(eth);
  
  switch (prefix) {
    case 'dateOfBirth': return {
      dateOfBirthEthYear: eth.year, 
      dateOfBirthEthMonth: eth.month, 
      dateOfBirthEthDay: eth.day,
      dateOfBirthGregorian: g,
    };
    case 'joiningDate': return {
      joiningDateEthYear: eth.year, 
      joiningDateEthMonth: eth.month, 
      joiningDateEthDay: eth.day,
      joiningDateGregorian: g,
    };
    case 'birthday': return {
      birthdayEthYear: eth.year, 
      birthdayEthMonth: eth.month, 
      birthdayEthDay: eth.day,
      birthdayGregorian: g,
    };
    case 'date': return {
      dateEthYear: eth.year, 
      dateEthMonth: eth.month, 
      dateEthDay: eth.day,
      dateGregorian: g,
    };
    case 'expiry': return {
      expiryEthYear: eth.year, 
      expiryEthMonth: eth.month, 
      expiryEthDay: eth.day,
      expiryGregorian: g,
    };
    case 'deadline': return {
      deadlineEthYear: eth.year, 
      deadlineEthMonth: eth.month, 
      deadlineEthDay: eth.day,
      deadlineGregorian: g,
    };
    case 'start': return {
      startEthYear: eth.year, 
      startEthMonth: eth.month, 
      startEthDay: eth.day,
      startGregorian: g,
    };
    default: {
      const _exhaustive: never = prefix;
      throw new Error(`Unknown ethFields prefix: ${_exhaustive}`);
    }
  }
}