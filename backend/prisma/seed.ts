import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const ARGON2_OPTIONS: Parameters<typeof argon2.hash>[1] = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

async function upsertUser(opts: {
  phone: string;
  email?: string;
  password: string;
  role: UserRole;
  status: UserStatus;
}) {
  const passwordHash = await argon2.hash(opts.password, ARGON2_OPTIONS);

  await prisma.user.upsert({
    where: { phone: opts.phone },
    create: {
      phone: opts.phone,
      email: opts.email,
      passwordHash,
      role: opts.role,
      status: opts.status,
    },
    update: {
      email: opts.email,
      passwordHash,
      role: opts.role,
      status: opts.status,
      deletedAt: null,
    },
  });

  console.log(
    `[seed] ${opts.role.padEnd(6)} ${opts.phone.padEnd(15)} password=${opts.password}`,
  );
}

async function main() {
  console.log('[seed] Seeding Rehobot dev accounts...');

  await upsertUser({
    phone: '0000000001',
    email: 'admin@rehobot.local',
    password: 'Admin1234!',
    role: UserRole.ADMIN,
    status: UserStatus.APPROVED,
  });

  await upsertUser({
    phone: '0000000002',
    email: 'leader@rehobot.local',
    password: 'Leader1234!',
    role: UserRole.LEADER,
    status: UserStatus.APPROVED,
  });

  await upsertUser({
    phone: '0000000003',
    email: 'member@rehobot.local',
    password: 'Member1234!',
    role: UserRole.MEMBER,
    status: UserStatus.APPROVED,
  });

  console.log('[seed] Done.');
}

main()
  .catch((e) => {
    console.error('[seed] Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });