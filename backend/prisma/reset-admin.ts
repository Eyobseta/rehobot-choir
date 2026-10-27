// prisma/reset-admin.ts
import 'dotenv/config';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const ARGON2_OPTIONS: Parameters<typeof argon2.hash>[1] = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

async function main() {
  // 👇 CHANGE THESE TO WHAT YOU WANT TO LOG IN WITH
  const adminPhone = "0911000000";
  const adminPassword = "AdminPassword123!";
  const adminEmail = "admin@rehobot.org";

  console.log(`Resetting Admin account for ${adminPhone}...`);

  const passwordHash = await argon2.hash(adminPassword, ARGON2_OPTIONS);

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
      mustChangePassword: false, // Turn this off so you don't have to change it immediately
      // Reset any locks
      accountLock: {
        update: { failedAttempts: 0, lockedUntil: null }
      }
    },
    create: {
      phone: adminPhone,
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
      mustChangePassword: false,
    },
  });

  console.log('✅ Admin account overwritten successfully!');
  console.log(`📱 Phone:    ${adminPhone}`);
  console.log(`🔑 Password: ${adminPassword}`);
  console.log('You can now log in to the app.');
}

main()
  .catch((e) => {
    console.error('Failed to reset admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });