import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import healthRoutes from './modules/health/health.routes';
import authRoutes from './auth/auth.routes';
import registrationRoutes from './registration/registration.routes';
import leaderRoutes from './registration/leader.routes';
import leaderMemberRoutes from './registration/leader-members.routes';
import memberRoutes from './members/members.routes';
import eventRoutes from './events/events.routes';
import leaderEventRoutes from './events/leader-events.routes';
import attendanceRoutes from './attendance/attendance.routes';
import leaderAttendanceRoutes from './attendance/leader-attendance.routes';
import announcementRoutes from './announcements/announcements.routes';
import leaderAnnouncementRoutes from './announcements/leader-announcements.routes';
import songRoutes from './songs/songs.routes';
import leaderSongRoutes from './songs/leader-songs.routes';
import zemaRoutes from './songs/zema.routes';
import memoryRoutes from './memories/memories.routes';
import leaderMemoryRoutes from './memories/leader-memories.routes';
import quoteRoutes from './quotes/quotes.routes';
import notificationRoutes from './notifications/notifications.routes';
import debugRoutes from './scheduler/debug.routes';
import birthdayRoutes from './birthdays/birthdays.routes';
import chatRoutes from './chat/chat.routes';
import chatStreamRoutes from './chat/chat.stream.routes';
import fundingRoutes from './funding/funding.routes';
import donationRoutes from './funding/donation.routes';
import fundingAdminRoutes from './funding/funding-admin.routes';
import helpRoutes from './help/help.routes';


export function createApp(): Application {
  const app = express();

  app.use(helmet());

  const corsOrigin =
    env.corsOrigin === '*'
      ? true
      : env.corsOrigin.split(',').map((s) => s.trim());
  app.use(cors({ origin: corsOrigin, credentials: true }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(requestLogger);

  // Rate limiter for Authentication Endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Increased limit for mobile apps (mobile makes many requests on boot)
    skipSuccessfulRequests: true, // CRITICAL FIX: Only count failed logins against the limit
    message: { status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const api = express.Router();
  api.use('/health', healthRoutes);
  
  // FIXED: Apply limiter ONLY to specific route registrations, not the whole router
  api.use('/auth', authLimiter, authRoutes);
  
  // Registration routes don't need the strict login limiter
  api.use('/auth', registrationRoutes);
  
  api.use('/leaders/registrations', leaderRoutes);
  api.use('/leaders/members', leaderMemberRoutes);
  api.use('/members', memberRoutes);
  api.use('/events', eventRoutes);
  api.use('/leaders/events', leaderEventRoutes);
  api.use('/attendance', attendanceRoutes);
  api.use('/leaders/attendance', leaderAttendanceRoutes);
  api.use('/announcements', announcementRoutes);
  api.use('/leaders/announcements', leaderAnnouncementRoutes);
  api.use('/songs', songRoutes);
  api.use('/leaders', leaderSongRoutes);
  api.use('/zema', zemaRoutes);
  api.use('/memories', memoryRoutes);
  api.use('/leaders/memories', leaderMemoryRoutes);
  api.use('/quotes', quoteRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/debug', debugRoutes);
  api.use('/birthdays', birthdayRoutes);
  
  api.use('/chats', chatStreamRoutes);
  api.use('/chats', chatRoutes);

  api.use('/funding', fundingRoutes);
  api.use('/funding', donationRoutes);
  api.use('/admin/funding', fundingAdminRoutes);
  api.use('/help', helpRoutes);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}