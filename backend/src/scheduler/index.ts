import cron from 'node-cron';
import { env } from '../config/env';
import { runBirthdayJob } from './birthdays.job';
import { runEventRemindersJob } from './eventReminders.job';
import { runNotificationCleanupJob } from './cleanup.job';
import { runFundingReminderJob } from '../funding/funding.job';

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
      console.log(`[scheduler] cleanup deleted ${result.deleted} rows`);
    } catch (e) {
      console.warn('[scheduler] cleanup failed', e);
    }
  });

  // 06:00 every day — birthdays
  cron.schedule('0 6 * * *', async () => {
    try {
      const result = await runBirthdayJob();
      console.log(`[scheduler] birthdays: today=${result.today} tomorrow=${result.tomorrow}`);
    } catch (e) {
      console.warn('[scheduler] birthday job failed', e);
    }
  });

  // Every 15 minutes — event reminders
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await runEventRemindersJob();
      console.log(`[scheduler] event reminders: 24h=${result.reminded24h} 1h=${result.reminded1h}`);
    } catch (e) {
      console.warn('[scheduler] event reminder job failed', e);
    }
  });

  // 07:00 Addis Ababa time every day — funding reminders
  cron.schedule(
    '0 7 * * *',
    async () => {
      try {
        const r = await runFundingReminderJob();
        console.log(`[scheduler] funding reminders: monthly=${r.monthly} preDeadline=${r.preDeadline}`);
      } catch (e) {
        console.warn('[scheduler] funding reminder job failed', e);
      }
    },
    { timezone: 'Africa/Addis_Ababa' },
  );

  // In development only, expose a way to run the jobs on demand
  if (env.nodeEnv === 'development') {
    console.log('[scheduler] jobs scheduled:');
    console.log('  - birthdays:  every day at 06:00');
    console.log('  - reminders:  every 15 minutes');
    console.log('  - cleanup:    every day at 03:00');
    console.log('  - funding:    every day at 07:00 (Addis Ababa)');
  }
}