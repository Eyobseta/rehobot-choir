import { NotificationType, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { fanOut } from '../notifications/notifications.service';

/**
 * Funding notifications never throw into the request: the money state is already
 * committed, and a push failure must not turn a successful action into an error.
 * force:true = essential workflow messages ignore per-type preferences (SRS 7).
 */
async function safe(fn: () => Promise<void>) {
  try { await fn(); } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[funding] notification failed', e);
  }
}

export function notifyLeadersVerificationNeeded(opts: {
  declarerId: string; declarerName: string; recordType: 'AnnualContributionRecord' | 'SpecialDonationPayment';
  recordId: string; what: string;
}) {
  return safe(async () => {
    const leaders = await prisma.user.findMany({
      where: { role: UserRole.LEADER, status: 'APPROVED', deletedAt: null, id: { not: opts.declarerId } },
      select: { id: true },
    });
    await fanOut({
      recipients: leaders.map((l) => l.id),
      type: NotificationType.FUNDING_VERIFICATION_NEEDED,
      title: 'Payment needs verification',
      body: `${opts.declarerName} declared a payment for ${opts.what}.`,
      relatedEntityType: opts.recordType,
      relatedEntityId: opts.recordId,
      force: true,
    });
  });
}

export function notifyMemberResult(opts: {
  memberId: string; approved: boolean; reason?: string | null; what: string;
  amountLabel?: string; remainingLabel?: string | null;
  recordType: 'AnnualContributionRecord' | 'SpecialDonationPayment'; recordId: string;
}) {
  return safe(async () => {
    await fanOut({
      recipients: [opts.memberId],
      type: NotificationType.FUNDING_RESULT,
      title: opts.approved ? 'Payment verified' : 'Payment not verified',
      body: opts.approved
        ? `Your ${opts.amountLabel ? opts.amountLabel + ' ' : ''}payment for ${opts.what} was verified.` +
          (opts.remainingLabel ? ` Remaining balance: ${opts.remainingLabel}.` : ' Thank you!')
        : `Your ${opts.amountLabel ? opts.amountLabel + ' ' : ''}payment for ${opts.what} could not be verified: ${opts.reason ?? 'no reason given'}. Please correct it and resubmit.`,
      relatedEntityType: opts.recordType,
      relatedEntityId: opts.recordId,
      force: true,
    });
  });
}