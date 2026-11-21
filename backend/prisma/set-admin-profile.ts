// prisma/set-admin-profile.ts
// Create or update the ADMIN's member profile (full name, gender, date of birth).
// Safe to re-run: it updates the same profile each time.
//
// 1) Edit the values in the PROFILE block below.
// 2) Run:  npx tsx prisma/set-admin-profile.ts

import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { ethFields } from '../src/utils/eth-fields';

const prisma = new PrismaClient();

// 👇 EDIT THESE 👇  (date of birth is ETHIOPIAN calendar)
const PROFILE = {
  fullName: 'Eyob Seta',
  gender: 'male', // 'male' or 'female' (same values the app uses)
  dob: { year: 1996, month: 3, day: 12 }, // E.C. year / month (1-13) / day
  emergencyContactName: 'MOM',
  emergencyContactPhone: '0952369191',
};

async function main() {
  const phone = process.env.ADMIN_PHONE;
  if (!phone) {
    console.error('❌ ADMIN_PHONE is missing in .env');
    process.exit(1);
  }

  const { fullName, gender, dob, emergencyContactName, emergencyContactPhone } = PROFILE;

  if (fullName.includes('YOUR FULL NAME') || emergencyContactPhone.includes('XXXX')) {
    console.error('❌ Edit the PROFILE block at the top of this file first.');
    process.exit(1);
  }
  if (dob.month < 1 || dob.month > 13 || dob.day < 1 || dob.day > 30) {
    console.error('❌ Invalid Ethiopian date (month 1-13, day 1-30; Pagume has 5-6 days).');
    process.exit(1);
  }

  const admin = await prisma.user.findUnique({ where: { phone } });
  if (!admin || admin.role !== UserRole.ADMIN) {
    console.error(`❌ No ADMIN account found with phone ${phone}`);
    process.exit(1);
  }

  const dobFields = ethFields(dob, 'dateOfBirth') as any;

  await prisma.memberProfile.upsert({
    where: { userId: admin.id },
    create: {
      userId: admin.id,
      fullName,
      gender,
      emergencyContactName,
      emergencyContactPhone,
      // Photo is required by the schema. Left empty on purpose;
      // upload a real photo from the app's Edit Profile screen.
      profilePhotoUrl: '',
      profilePhotoPublicId: '',
      ...dobFields,
    },
    update: {
      fullName,
      gender,
      emergencyContactName,
      emergencyContactPhone,
      ...dobFields,
    },
  });

  console.log('✅ Admin profile saved');
  console.table({
    fullName,
    gender,
    dobEthiopian: `${dob.year}-${dob.month}-${dob.day}`,
  });
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });