import { prisma } from '../db/prisma';

/**
 * SRS 16.3 — Notification history is retained for 30 days.
 */
export async function runNotificationCleanupJob(): Promise<{
  deleted: number;
}> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { deleted: result.count };
}

/**
 * SRS Help module — query logs are retained for 90 days.
 */
export async function runHelpCleanupJob(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const result = await prisma.helpQueryLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return { deleted: result.count };
}