// prisma/eth-helpers.ts  (new file — import in services)
import { EthDate, fromEthiopian, toEthiopian } from './ethiopian-date';

export function ethFields(eth: EthDate, prefix: 'date' | 'expiry' | 'deadline' | 'start' | 'dateOfBirth' | 'joiningDate' | 'birthday') {
  const g = fromEthiopian(eth);
  switch (prefix) {
    case 'dateOfBirth': return {
      dateOfBirthEthYear: eth.year, dateOfBirthEthMonth: eth.month, dateOfBirthEthDay: eth.day,
      dateOfBirthGregorian: g,
    };
    case 'joiningDate': return {
      joiningDateEthYear: eth.year, joiningDateEthMonth: eth.month, joiningDateEthDay: eth.day,
      joiningDateGregorian: g,
    };
    case 'birthday': return {
      birthdayEthYear: eth.year, birthdayEthMonth: eth.month, birthdayEthDay: eth.day,
      birthdayGregorian: g,
    };
    default: return {
      [`${prefix}EthYear`]: eth.year, [`${prefix}EthMonth`]: eth.month, [`${prefix}EthDay`]: eth.day,
      [`${prefix}Gregorian`]: g,
    };
  }
}