// prisma/create-admin.ts
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
  console.log('Creating initial Admin account...');

  const adminPhone = '0000000001'; // You can log in with this
  const adminPassword = 'AdminPassword123!'; // Change this immediately after login!
  const adminEmail = 'admin@yourdomain.com';

  const passwordHash = await argon2.hash(adminPassword, ARGON2_OPTIONS);

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
    },
    create: {
      phone: adminPhone,
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
    },
  });

  console.log('✅ Admin created successfully!');
  console.log(`Phone: ${adminPhone}`);
  console.log(`Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('Failed to create admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });