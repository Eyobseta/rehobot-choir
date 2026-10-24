import { prisma } from '../db/prisma';
import { deleteByPublicId } from '../storage/cloudinary';

/**
 * SRS 19.15 / 26.3 — chat photos and voice media are kept for 1 year, then
 *   purged from storage. The message row (and its text) stays; the API marks
 *   such messages with `mediaExpired: true`.
 * SRS 19.23 — message reports are kept for at most 30 days.
 */
export async function runChatCleanupJob(): Promise<{
  mediaDeleted: number;
  reportsDeleted: number;
}> {
  const now = new Date();
  let mediaDeleted = 0;

  // Process in batches so a big backlog cannot hold the process hostage.
  for (let round = 0; round < 25; round++) {
    const batch = await prisma.chatMedia.findMany({
      where: { retentionUntil: { lt: now } },
      take: 200,
      select: { id: true, type: true, storagePublicId: true },
    });
    if (batch.length === 0) break;

    await Promise.all(
      batch.map((m) =>
        deleteByPublicId(m.storagePublicId, m.type === 'VOICE' ? 'video' : 'image'),
      ),
    );
    await prisma.chatMedia.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } });
    mediaDeleted += batch.length;
  }

  const reports = await prisma.messageReport.deleteMany({
    where: { retainUntil: { lt: now } },
  });

  return { mediaDeleted, reportsDeleted: reports.count };
}