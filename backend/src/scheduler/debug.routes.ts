import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../auth/middleware';
import { env } from '../config/env';
import { runBirthdayJob } from './birthdays.job';
import { runEventRemindersJob } from './eventReminders.job';
import { runNotificationCleanupJob, runHelpCleanupJob } from './cleanup.job';
import { ApiError } from '../utils/ApiError';
import { runFundingReminderJob } from '../funding/funding.job';

const router = Router();

// Development-only. Disabled automatically in production.
router.use((_req, _res, next) => {
  if (env.nodeEnv !== 'development') {
    return next(ApiError.notFound());
  }
  next();
});

router.use(authenticate, authorize('ADMIN', 'LEADER'));

router.post('/birthdays', async (_req, res, next) => {
  try {
    const result = await runBirthdayJob();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/event-reminders', async (_req, res, next) => {
  try {
    const result = await runEventRemindersJob();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/cleanup', async (_req, res, next) => {
  try {
    const result = await runNotificationCleanupJob();
    res.json(result);
  } catch (e) {
    next(e);
  }
});


router.post('/funding-reminders', async (_req, res, next) => {
  try { res.json(await runFundingReminderJob()); } catch (e) { next(e); }
});

router.post('/help-cleanup', async (_req, res, next) => {
  try {
    res.json(await runHelpCleanupJob());
  } catch (e) {
    next(e);
  }
});
export default router;