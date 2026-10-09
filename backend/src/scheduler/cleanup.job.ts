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