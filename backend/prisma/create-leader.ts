// prisma/create-leader.ts
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
  console.log('Creating initial Leader account...');

  // Read credentials from .env (You will need to add these to your .env)
  const leaderPhone = process.env.LEADER_PHONE;
  const leaderPassword = process.env.LEADER_PASSWORD;
  const leaderEmail = process.env.LEADER_EMAIL;

  if (!leaderPhone || !leaderPassword || !leaderEmail) {
    console.error('❌ Error: Missing LEADER_PHONE, LEADER_PASSWORD, or LEADER_EMAIL in .env file.');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(leaderPassword, ARGON2_OPTIONS);

  await prisma.user.upsert({
    where: { phone: leaderPhone },
    update: {
      passwordHash,
      email: leaderEmail,
      role: UserRole.LEADER, // <--- Changed to LEADER
      status: UserStatus.APPROVED,
    },
    create: {
      phone: leaderPhone,
      email: leaderEmail,
      passwordHash,
      role: UserRole.LEADER, // <--- Changed to LEADER
      status: UserStatus.APPROVED,
      mustChangePassword: true,
    },
  });

  console.log('✅ Leader created successfully!');
  console.log(`Phone: ${leaderPhone}`);
  console.log(`Email: ${leaderEmail}`);
}

main()
  .catch((e) => {
    console.error('Failed to create leader:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });