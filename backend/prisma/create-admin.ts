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

  // Read credentials from .env
  const adminPhone = process.env.ADMIN_PHONE;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminEmail = process.env.ADMIN_EMAIL;

  // Ensure they are actually set
  if (!adminPhone || !adminPassword || !adminEmail) {
    console.error('❌ Error: Missing ADMIN_PHONE, ADMIN_PASSWORD, or ADMIN_EMAIL in .env file.');
    process.exit(1);
  }

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
  console.log(`Email: ${adminEmail}`);
  console.log('Password: (hidden, check your .env file)');
}

main()
  .catch((e) => {
    console.error('Failed to create admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });