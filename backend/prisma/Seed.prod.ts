// prisma/seed.prod.ts — PRODUCTION bootstrap (idempotent, safe to re-run)
//
// Creates ONLY what a brand-new production DB needs:
//   1. One ADMIN account (from .env)
//   2. Song categories
//   3. In-app help entries
//   4. The GENERAL chat conversation (+ admin as member)
//
// No demo users, no fake photos, no sample content.
//
// Required .env values:
//   DATABASE_URL, DIRECT_URL   (your NEON urls)
//   ADMIN_PHONE, ADMIN_EMAIL, ADMIN_PASSWORD
//
// Run:  npx tsx prisma/seed.prod.ts      (or ts-node, same as create-admin.ts)

import 'dotenv/config';
import {
  PrismaClient,
  UserRole,
  UserStatus,
  ConversationType,
} from '@prisma/client';
import argon2 from 'argon2';
import { seedHelpEntries } from './help.seed'; // adjust filename if yours is help_seed.ts

const prisma = new PrismaClient();

const ARGON2_OPTIONS: Parameters<typeof argon2.hash>[1] = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const SONG_CATEGORIES = ['Worship', 'Zema', 'Anthem'];

function dbHost(): string {
  try {
    return new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '').host;
  } catch {
    return '(unknown)';
  }
}

async function main() {
  const phone = process.env.ADMIN_PHONE;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!phone || !email || !password) {
    console.error('❌ Missing ADMIN_PHONE, ADMIN_EMAIL or ADMIN_PASSWORD in .env');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error('❌ ADMIN_PASSWORD must be at least 10 characters.');
    process.exit(1);
  }

  console.log(`[seed:prod] Target database host: ${dbHost()}`);

  // ---- 1. Admin ----
  let admin = await prisma.user.findUnique({ where: { phone } });
  if (admin) {
    // Never overwrite an existing password on re-run.
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: { role: UserRole.ADMIN, status: UserStatus.APPROVED, deletedAt: null },
    });
    console.log('[seed:prod] Admin already exists — role/status ensured, password untouched.');
  } else {
    admin = await prisma.user.create({
      data: {
        phone,
        email,
        passwordHash: await argon2.hash(password, ARGON2_OPTIONS),
        role: UserRole.ADMIN,
        status: UserStatus.APPROVED,
        mustChangePassword: true, // forces a new password at first login
      },
    });
    console.log('[seed:prod] Admin created.');
  }

  await prisma.notificationPreference.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id },
    update: {},
  });

  // ---- 2. Song categories ----
  for (const name of SONG_CATEGORIES) {
    await prisma.songCategory.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log(`[seed:prod] Song categories: ${SONG_CATEGORIES.join(', ')}`);

  // ---- 3. Help entries ----
  const helpCount = await seedHelpEntries(prisma);
  console.log(`[seed:prod] Help entries upserted: ${helpCount}`);

  // ---- 4. GENERAL chat ----
  let general = await prisma.chatConversation.findFirst({
    where: { type: ConversationType.GENERAL },
  });
  if (!general) {
    general = await prisma.chatConversation.create({
      data: { type: ConversationType.GENERAL },
    });
    console.log('[seed:prod] GENERAL chat conversation created.');
  }
  await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId: general.id, userId: admin.id } },
    create: { conversationId: general.id, userId: admin.id },
    update: { leftAt: null },
  });
  await prisma.chatReadState.upsert({
    where: { conversationId_userId: { conversationId: general.id, userId: admin.id } },
    create: { conversationId: general.id, userId: admin.id },
    update: {},
  });

  // ---- Summary ----
  const [users, cats, help, convs] = await Promise.all([
    prisma.user.count(),
    prisma.songCategory.count(),
    prisma.helpEntry.count(),
    prisma.chatConversation.count(),
  ]);
  console.log('\n✅ Production bootstrap complete');
  console.table({ users, songCategories: cats, helpEntries: help, conversations: convs });
  console.log(`📱 Admin phone: ${phone}  (log in, then change the password when prompted)`);
}

main()
  .catch((e) => {
    console.error('❌ seed:prod failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });