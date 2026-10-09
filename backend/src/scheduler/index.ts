import cron from 'node-cron';
import { env } from '../config/env';
import { runBirthdayJob } from './birthdays.job';
import { runEventRemindersJob } from './eventReminders.job';
import { runNotificationCleanupJob } from './cleanup.job';

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  // eslint-disable-next-line no-console
  console.log('[scheduler] starting cron jobs...');

  // 03:00 every day — cleanup
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await runNotificationCleanupJob();
      // eslint-disable-next-line no-console
      console.log(`[scheduler] cleanup deleted ${result.deleted} rows`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[scheduler] cleanup failed', e);
    }
  });

  // 06:00 every day — birthdays
  cron.schedule('0 6 * * *', async () => {
    try {
      const result = await runBirthdayJob();
      // eslint-disable-next-line no-console
      console.log(
        `[scheduler] birthdays: today=${result.today} tomorrow=${result.tomorrow}`,
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[scheduler] birthday job failed', e);
    }
  });

  // Every 15 minutes — event reminders
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await runEventRemindersJob();
      // eslint-disable-next-line no-console
      console.log(
        `[scheduler] event reminders: 24h=${result.reminded24h} 1h=${result.reminded1h}`,
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[scheduler] event reminder job failed', e);
    }
  });

  // In development only, expose a way to run the jobs on demand
  // (see the /debug endpoints in a later step or via Postman).
  if (env.nodeEnv === 'development') {
    // eslint-disable-next-line no-console
    console.log('[scheduler] jobs scheduled:');
    // eslint-disable-next-line no-console
    console.log('  - birthdays:  every day at 06:00');
    // eslint-disable-next-line no-console
    console.log('  - reminders:  every 15 minutes');
    // eslint-disable-next-line no-console
    console.log('  - cleanup:    every day at 03:00');
  }
}