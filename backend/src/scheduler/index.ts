import cron from 'node-cron';
import { env } from '../config/env';
import { runBirthdayJob } from './birthdays.job';
import { runEventRemindersJob } from './eventReminders.job';
import { runFundingReminderJob } from '../funding/funding.job';
import { runNotificationCleanupJob, runHelpCleanupJob } from './cleanup.job';


let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;

  // eslint-disable-next-line no-console
  console.log('[scheduler] starting cron jobs...');
  // 03:00 server-local every day — cleanup
  cron.schedule('0 3 * * *', async () => {
    try {
      const n = await runNotificationCleanupJob();
      const h = await runHelpCleanupJob();
      console.log(`[scheduler] cleanup deleted ${n.deleted} notifications, ${h.deleted} help logs`);
    } catch (e) {
      console.warn('[scheduler] cleanup failed', e);
    }
  });

  // 06:00 server-local every day — birthdays
  cron.schedule('0 6 * * *', async () => {
    try {
      const result = await runBirthdayJob();
      console.log(
        `[scheduler] birthdays: today=${result.today} tomorrow=${result.tomorrow}`,
      );
    } catch (e) {
      console.warn('[scheduler] birthday job failed', e);
    }
  });

  // 07:00 EAT — same-day event reminders
  // Fires ~2–3h before morning services, ~11–12h before evening practices.
  // Culturally: dawn / wake-up / before morning prayers.
  cron.schedule(
    '0 7 * * *',
    async () => {
      try {
        const result = await runEventRemindersJob(new Date(), 'same_day');
        console.log(`[scheduler] same-day event reminders: ${result.sameDay}`);
      } catch (e) {
        console.warn('[scheduler] same-day reminder job failed', e);
      }
    },
    { timezone: 'Africa/Addis_Ababa' },
  );

  // 19:00 EAT — day-before event reminders
  // Fires ~12–17h before event time.
  // Culturally: after dinner, evening planning time.
  cron.schedule(
    '0 19 * * *',
    async () => {
      try {
        const result = await runEventRemindersJob(new Date(), 'day_before');
        console.log(
          `[scheduler] day-before event reminders: ${result.dayBefore}`,
        );
      } catch (e) {
        console.warn('[scheduler] day-before reminder job failed', e);
      }
    },
    { timezone: 'Africa/Addis_Ababa' },
  );

  // 07:00 EAT — funding reminders
  cron.schedule(
    '0 7 * * *',
    async () => {
      try {
        const r = await runFundingReminderJob();
        console.log(
          `[scheduler] funding reminders: monthly=${r.monthly} preDeadline=${r.preDeadline}`,
        );
      } catch (e) {
        console.warn('[scheduler] funding reminder job failed', e);
      }
    },
    { timezone: 'Africa/Addis_Ababa' },
  );

  // In development only, expose a way to run the jobs on demand
  if (env.nodeEnv === 'development') {
    console.log('[scheduler] jobs scheduled:');
    console.log('  - cleanup:              03:00 server-local');
    console.log('  - birthdays:            06:00 server-local');
    console.log('  - event same-day:       07:00 EAT (04:00 UTC)');
    console.log('  - event day-before:     19:00 EAT (16:00 UTC)');
    console.log('  - funding reminders:    07:00 EAT (04:00 UTC)');
  }
}