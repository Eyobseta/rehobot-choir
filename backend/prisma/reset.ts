// prisma/reset.ts — DEV ONLY
import 'dotenv/config'; // Fixes 'process' error
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[reset] Truncating all tables...');

  const tables = [
    // Funding (children first)
    'funding_reminder_logs',
    'funding_audit_logs',
    'funding_declarations',
    'special_donation_payments',
    'special_donation_campaigns',
    'annual_contribution_records',
    'annual_funding_configurations',
    'payment_instructions',

    // Chat
    'message_reports',
    'message_pins',
    'message_reactions',
    'chat_media',
    'chat_messages',
    'chat_read_states',
    'chat_groups',
    'conversation_members',
    'chat_conversations',

    // Birthdays
    'birthday_comment_likes',
    'birthday_comments',
    'birthday_reactions',
    'birthday_posts',

    // Memories / quotes
    'memory_media',
    'memories',
    'daily_quotes',

    // Notifications
    'notification_preferences',
    'push_tokens',
    'notifications',

    // Announcements
    'announcement_songs',
    'announcements',

    // Events / attendance
    'attendance_records',
    'event_rsvps',
    'event_attachments',
    'events',

    // Songs / Zema
    'song_submissions',
    'zema_memberships',
    'song_favorites',
    'songs',
    'song_categories',

    // Users / auth
    'member_profiles',
    'registration_applications',
    'account_locks',
    'sessions',
    'users',
  ];

  for (const t of tables) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE;`,
    );
  }

  console.log('[reset] Done. Database is empty.');
}

main()
  .catch((e) => {
    console.error('[reset] Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });