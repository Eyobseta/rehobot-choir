import { NotificationType, FundingRecordType, FundingStatus, Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { fanOut } from '../notifications/notifications.service';
import {
  ethTodayFromInstant, ethDaysBetween, utcDateToEth, formatEthDate, EthDate,
} from '../utils/ethiopianCalendar';
import { formatEtb } from '../utils/money';
import { isPastDeadline } from './funding.dto';
import { getCurrentConfig, ensureRecordsForConfig } from './funding.config.service';

/**
 * Claim a (recipient, record, kind, period) slot. The unique index makes this atomic, so even if
 * the job runs twice (restart, two instances, manual trigger) each person is reminded once.
 */
async function claim(recipientId: string, recordId: string, kind: string, periodKey: string): Promise<boolean> {
  try {
    await prisma.fundingReminderLog.create({
      data: { recipientId, recordType: FundingRecordType.ANNUAL, recordId, kind, periodKey },
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
    throw e;
  }
}

/**
 * SRS 7 — annual contribution reminders. Run daily (see scheduler snippet).
 *  - Monthly reminder (on the configured Ethiopian day of month) -> UNPAID records ONLY.
 *  - Pre-deadline reminder (default 7 Ethiopian days before) -> UNPAID records ONLY.
 *  - Pending Verification / Paid never get "please pay" reminders.
 *  - Rejected members are told the reason at rejection time (funding.notify), not nagged here.
 *  - Wording never says an expired deadline is still in the future.
 * All dates come from the SERVER clock + Addis Ababa offset, never the phone.
 */
export async function runFundingReminderJob(now = new Date()): Promise<{ monthly: number; preDeadline: number }> {
  const config = await getCurrentConfig();
  if (!config) return { monthly: 0, preDeadline: 0 };

  // Pick up people approved since the config was saved.
  await ensureRecordsForConfig(config);

  const today = ethTodayFromInstant(now);
  const deadline: EthDate = utcDateToEth(config.deadlineDate);
  const past = isPastDeadline(config.deadlineDate, now);
  const daysLeft = ethDaysBetween(today, deadline);

  // In runFundingReminderJob, the `unpaid` query should EXCLUDE participants with pending declarations:
const unpaid = await prisma.annualContributionRecord.findMany({
  where: {
    configId: config.id,
    status: FundingStatus.UNPAID,
    participant: { status: 'APPROVED', deletedAt: null },
    // v2.1: don't nag while a declaration is being verified.
    declarations: { none: { status: 'PENDING' } },
  },
  select: { id: true, participantId: true, amountDueMinor: true, paidMinor: true },
});
  if (unpaid.length === 0) return { monthly: 0, preDeadline: 0 };

  const dueLabel = formatEthDate(deadline, 'en');
  const out = { monthly: 0, preDeadline: 0 };

  const send = async (rows: typeof unpaid, kind: string, periodKey: string, title: string, bodyFor: (amt: number) => string) => {
    const claimed: typeof unpaid = [];
    for (const r of rows) if (await claim(r.participantId, r.id, kind, periodKey)) claimed.push(r);
    // Group by amount so each message states the right figure.
    const byAmount = new Map<number, string[]>();
    for (const r of claimed) {
      const remaining = r.amountDueMinor - r.paidMinor; // v2: partial payments -> remind the balance
      if (remaining > 0) byAmount.set(remaining, [...(byAmount.get(remaining) ?? []), r.participantId]);
    }
    for (const [amt, ids] of byAmount) {
      await fanOut({
        recipients: ids, type: NotificationType.FUNDING_REMINDER, title, body: bodyFor(amt),
        relatedEntityType: 'AnnualContributionRecord', relatedEntityId: null,
      });
    }
    return claimed.length;
  };

  // Monthly
  if (config.monthlyReminderEnabled && today.day === Math.min(config.monthlyReminderEthDay, 30)) {
    out.monthly = await send(
      unpaid, 'MONTHLY', `${today.year}-${today.month}`,
      'Annual hosting contribution',
      (amt) => past
        ? `Your remaining ${formatEtb(amt)} for ${config.contributionYear} E.C. is overdue (deadline was ${dueLabel}). Please pay and tap "I've Transferred".`
        : `Your remaining ${formatEtb(amt)} for ${config.contributionYear} E.C. is due by ${dueLabel}.`,
    );
  }

  // Pre-deadline
  if (!past && config.preDeadlineReminderDays > 0 && daysLeft === config.preDeadlineReminderDays) {
    out.preDeadline = await send(
      unpaid, 'PRE_DEADLINE', `${config.contributionYear}-pre`,
      'Contribution deadline is near',
      (amt) => `${config.preDeadlineReminderDays} days left: please pay your remaining ${formatEtb(amt)} by ${dueLabel}.`,
    );
  }
  return out;
}