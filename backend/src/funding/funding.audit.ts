import { Prisma, FundingRecordType } from '@prisma/client';
import { prisma } from '../db/prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export type AuditInput = {
  actorId: string | null;
  action: string;
  recordType: FundingRecordType;
  recordId: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  reason?: string | null;
  details?: Prisma.InputJsonValue;
};

/**
 * Append-only. This module deliberately exports NO update/delete helper for audit rows,
 * and no route may be added that mutates them (SRS 13).
 * Pass the transaction client so the audit row commits/rolls back with the change it describes.
 */
export async function writeAudit(db: Db, a: AuditInput): Promise<void> {
  await db.fundingAuditLog.create({
    data: {
      actorId: a.actorId,
      action: a.action,
      recordType: a.recordType,
      recordId: a.recordId,
      previousStatus: a.previousStatus ?? null,
      newStatus: a.newStatus ?? null,
      reason: a.reason ?? null,
      details: a.details,
    },
  });
}
