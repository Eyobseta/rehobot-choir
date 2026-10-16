// prisma/reset.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[reset] Truncating all tables...');

  // Order matters only if FKs aren't CASCADE, but we use CASCADE below.
  const tables = [
    'message_reports',
    'message_pins',
    'message_reactions',
    'chat_media',
    'chat_messages',
    'chat_read_states',
    'chat_groups',
    'conversation_members',
    'chat_conversations',
    'birthday_comment_likes',
    'birthday_comments',
    'birthday_reactions',
    'birthday_posts',
    'memory_media',
    'memories',
    'daily_quotes',
    'notification_preferences',
    'push_tokens',
    'notifications',
    'announcement_songs',
    'announcements',
    'attendance_records',
    'event_rsvps',
    'event_attachments',
    'events',
    'song_submissions',
    'zema_memberships',
    'song_favorites',
    'songs',
    'song_categories',
    'member_profiles',
    'registration_applications',
    'account_locks',
    'sessions',
    'users',
  ];

  // Use a single statement per table for clarity.
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