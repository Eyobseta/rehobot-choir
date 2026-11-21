// prisma/promote-to-leader.ts
// Promote an existing, APPROVED member to LEADER.
//
// Usage:  npx tsx prisma/promote-to-leader.ts 0911223344
//
// The person must already have registered in the app and been approved,
// so they have a real profile (name, photo). This does NOT create accounts.

import 'dotenv/config';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    console.error('Usage: promote-to-leader.ts <phone>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { memberProfile: true },
  });

  if (!user) {
    console.error(`❌ No user with phone ${phone}. Did they register? Is the phone format identical to the app's?`);
    process.exit(1);
  }
  if (user.status !== UserStatus.APPROVED) {
    console.error(`❌ User status is ${user.status}. Approve their registration first.`);
    process.exit(1);
  }
  if (user.role !== UserRole.MEMBER) {
    console.log(`ℹ️  User is already ${user.role}. Nothing to do.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: UserRole.LEADER },
  });

  console.log(`✅ ${user.memberProfile?.fullName ?? phone} is now a LEADER.`);
  console.log('Ask them to log out and back in so the new role takes effect.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });