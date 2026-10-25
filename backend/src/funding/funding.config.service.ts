import { Prisma, FundingRecordType, PaymentMethod, UserRole, FundingStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import {
  EthDate, calculateAnnualDeadline, ethToUtcDate, compareEth,
} from '../utils/ethiopianCalendar';
import { isValidAmountMinor } from '../utils/money';
import { writeAudit } from './funding.audit';
import { dateDto, ethDto, moneyDto } from './funding.dto';
import {
  reqString, optString, reqInt, optBool, reqEthDate,
} from './funding.validation';

// ============================================================
// Annual configuration (admin)
// ============================================================

export async function getCurrentConfig() {
  // "Current" = the active configuration with the highest contribution year.
  return prisma.annualFundingConfiguration.findFirst({
    where: { active: true },
    orderBy: { contributionYear: 'desc' },
  });
}

type ConfigRow = NonNullable<Awaited<ReturnType<typeof getCurrentConfig>>>;

export function configDto(c: ConfigRow) {
  return {
    id: c.id,
    contributionYear: c.contributionYear,
    amount: moneyDto(c.amountMinor),
    includeMembers: c.includeMembers,
    includeLeaders: c.includeLeaders,
    expiry: dateDto(c.expiryDate),
    deadline: dateDto(c.deadlineDate),
    monthlyReminderEnabled: c.monthlyReminderEnabled,
    monthlyReminderEthDay: c.monthlyReminderEthDay,
    preDeadlineReminderDays: c.preDeadlineReminderDays,
    receiptUploadsEnabled: c.receiptUploadsEnabled,
    referenceEnabled: c.referenceEnabled,
    active: c.active,
    updatedAt: c.updatedAt,
  };
}

export async function adminGetConfigs() {
  const rows = await prisma.annualFundingConfiguration.findMany({
    orderBy: { contributionYear: 'desc' },
    take: 20,
  });
  return rows.map(configDto);
}

/** Server-authoritative deadline preview (SRS 3.3). The app shows this before the admin saves. */
export function previewDeadline(body: any) {
  const expiry = reqEthDate(body?.expiry, 'Expiry date');
  const deadline = calculateAnnualDeadline(expiry);
  return { expiry: ethDto(expiry), deadline: ethDto(deadline) };
}

export async function adminUpsertConfig(adminId: string, body: any) {
  const contributionYear = reqInt(body?.contributionYear, 'Contribution year', 2000, 2100);
  const amountMinor = body?.amountMinor;
  if (!isValidAmountMinor(amountMinor)) {
    throw ApiError.badRequest('Amount must be a positive amount in ETB.', 'INVALID_AMOUNT');
  }
  const includeMembers = optBool(body?.includeMembers, 'includeMembers') ?? true;
  const includeLeaders = optBool(body?.includeLeaders, 'includeLeaders') ?? true;
  if (!includeMembers && !includeLeaders) {
    throw ApiError.badRequest('At least one participant group must be eligible.');
  }

  const expiry = reqEthDate(body?.expiry, 'Expiry date');
  const deadline = calculateAnnualDeadline(expiry);

  // Admin must have reviewed THIS deadline (backend is authoritative).
  const confirmed = reqEthDate(body?.confirmedDeadline, 'Confirmed deadline');
  if (compareEth(confirmed, deadline) !== 0) {
    throw ApiError.conflict(
      'The deadline changed. Review the new calculated deadline and confirm again.',
      'DEADLINE_NOT_CONFIRMED',
    );
  }

  const monthlyReminderEnabled = optBool(body?.monthlyReminderEnabled, 'monthlyReminderEnabled') ?? true;
  const monthlyReminderEthDay = body?.monthlyReminderEthDay === undefined ? 1 : reqInt(body.monthlyReminderEthDay, 'Reminder day', 1, 30);
  const preDeadlineReminderDays = body?.preDeadlineReminderDays === undefined ? 7 : reqInt(body.preDeadlineReminderDays, 'Pre-deadline reminder days', 0, 30);
  const receiptUploadsEnabled = optBool(body?.receiptUploadsEnabled, 'receiptUploadsEnabled') ?? false;
  const referenceEnabled = optBool(body?.referenceEnabled, 'referenceEnabled') ?? true;
  const active = optBool(body?.active, 'active') ?? true;

  const existing = await prisma.annualFundingConfiguration.findUnique({ where: { contributionYear } });
  const reason = existing ? reqString(body?.reason, 'Reason for change', 3, 300) : optString(body?.reason, 'Reason', 300);

  const data = {
    amountMinor, includeMembers, includeLeaders,
    expiryEthYear: expiry.year, expiryEthMonth: expiry.month, expiryEthDay: expiry.day,
    expiryDate: ethToUtcDate(expiry),
    deadlineEthYear: deadline.year, deadlineEthMonth: deadline.month, deadlineEthDay: deadline.day,
    deadlineDate: ethToUtcDate(deadline),
    monthlyReminderEnabled, monthlyReminderEthDay, preDeadlineReminderDays,
    receiptUploadsEnabled, referenceEnabled, active,
    updatedByUserId: adminId,
  };

  const saved = await prisma.$transaction(async (tx) => {
    const row = existing
      ? await tx.annualFundingConfiguration.update({ where: { id: existing.id }, data })
      : await tx.annualFundingConfiguration.create({
          data: { ...data, contributionYear, createdByUserId: adminId },
        });

    // A changed amount only affects records nobody has declared against yet.
    // Declared/Paid/Rejected records keep the amount they were created/decided with.
    let repriced = 0;
    if (existing && existing.amountMinor !== amountMinor) {
      const r = await tx.annualContributionRecord.updateMany({
        where: { configId: row.id, status: FundingStatus.UNPAID, paidMinor: 0 }, // partially-paid keep their snapshot
        data: { amountDueMinor: amountMinor },
      });
      repriced = r.count;
    }

    await writeAudit(tx, {
      actorId: adminId,
      action: existing ? 'CONFIG_UPDATED' : 'CONFIG_CREATED',
      recordType: FundingRecordType.CONFIGURATION,
      recordId: row.id,
      reason,
      details: {
        before: existing ? snapshot(existing) : null,
        after: snapshot(row),
        unpaidRecordsRepriced: repriced,
      },
    });
    return row;
  });

  // Create any missing per-participant records (works for Admin AND Leader callers).
  if (saved.active) await ensureRecordsForConfig(saved);
  return configDto(saved);
}

function snapshot(c: ConfigRow) {
  return {
    contributionYear: c.contributionYear, amountMinor: c.amountMinor,
    includeMembers: c.includeMembers, includeLeaders: c.includeLeaders,
    expiry: { y: c.expiryEthYear, m: c.expiryEthMonth, d: c.expiryEthDay },
    deadline: { y: c.deadlineEthYear, m: c.deadlineEthMonth, d: c.deadlineEthDay },
    monthlyReminderEnabled: c.monthlyReminderEnabled, monthlyReminderEthDay: c.monthlyReminderEthDay,
    preDeadlineReminderDays: c.preDeadlineReminderDays,
    receiptUploadsEnabled: c.receiptUploadsEnabled, referenceEnabled: c.referenceEnabled, active: c.active,
  } satisfies Prisma.InputJsonValue;
}

/** Eligible = approved, not deleted, in an included role. The Admin is never a payer. */
export function eligibleWhere(c: { includeMembers: boolean; includeLeaders: boolean }): Prisma.UserWhereInput {
  const roles: UserRole[] = [];
  if (c.includeMembers) roles.push(UserRole.MEMBER);
  if (c.includeLeaders) roles.push(UserRole.LEADER);
  return { status: 'APPROVED', deletedAt: null, role: { in: roles } };
}

/** Creates the missing yearly records. Existing records (any status) are never touched. */
export async function ensureRecordsForConfig(c: ConfigRow) {
  const users = await prisma.user.findMany({ where: eligibleWhere(c), select: { id: true } });
  if (users.length === 0) return 0;
  const r = await prisma.annualContributionRecord.createMany({
    data: users.map((u) => ({
      configId: c.id, participantId: u.id,
      contributionYear: c.contributionYear, amountDueMinor: c.amountMinor,
    })),
    skipDuplicates: true, // @@unique([participantId, contributionYear])
  });
  return r.count;
}

// ============================================================
// Payment instructions (admin writes, everyone authenticated reads active ones)
// ============================================================

const CREDENTIAL_WORDS = /\b(pin|otp|password|passcode|cvv)\b/i;

function validateInstruction(body: any, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || body?.method !== undefined) {
    if (body?.method !== 'BANK' && body?.method !== 'TELEBIRR') {
      throw ApiError.badRequest('Method must be BANK or TELEBIRR.');
    }
    out.method = body.method as PaymentMethod;
  }
  if (!partial || body?.providerName !== undefined) out.providerName = reqString(body?.providerName, 'Provider name', 2, 80);
  if (!partial || body?.accountHolderName !== undefined) out.accountHolderName = reqString(body?.accountHolderName, 'Account holder name', 2, 120);
  if (!partial || body?.accountIdentifier !== undefined) {
    const id = reqString(body?.accountIdentifier, 'Account number', 3, 40);
    if (!/^[A-Za-z0-9 \-+]+$/.test(id) || CREDENTIAL_WORDS.test(id)) {
      throw ApiError.badRequest('Account number may only contain letters, digits, spaces, "-" and "+".');
    }
    out.accountIdentifier = id;
  }
  if (body?.note !== undefined) {
    const note = optString(body.note, 'Note', 300);
    if (note && CREDENTIAL_WORDS.test(note)) {
      throw ApiError.badRequest('Never put PINs, OTPs or passwords in payment instructions.', 'CREDENTIAL_IN_NOTE');
    }
    out.note = note;
  }
  const active = optBool(body?.active, 'active');
  if (active !== undefined) out.active = active;
  return out;
}

export function instructionDto(i: {
  id: string; method: PaymentMethod; providerName: string; accountHolderName: string;
  accountIdentifier: string; note: string | null; active: boolean;
}) {
  return {
    id: i.id, method: i.method, providerName: i.providerName,
    accountHolderName: i.accountHolderName, accountIdentifier: i.accountIdentifier,
    note: i.note, active: i.active,
  };
}

export async function listActiveInstructions() {
  const rows = await prisma.paymentInstructions.findMany({
    where: { active: true }, orderBy: [{ method: 'asc' }, { createdAt: 'asc' }], take: 10,
  });
  return rows.map(instructionDto);
}

export async function adminListInstructions() {
  const rows = await prisma.paymentInstructions.findMany({ orderBy: { createdAt: 'asc' }, take: 50 });
  return rows.map(instructionDto);
}

function requireConfirm(body: any) {
  if (body?.confirm !== true) {
    throw ApiError.badRequest('Please confirm the change.', 'CONFIRMATION_REQUIRED');
  }
}

export async function adminCreateInstruction(adminId: string, body: any) {
  requireConfirm(body);
  const data = validateInstruction(body, false) as any;
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx.paymentInstructions.create({ data: { ...data, updatedByUserId: adminId } });
    await writeAudit(tx, {
      actorId: adminId, action: 'PAYMENT_INSTRUCTIONS_CREATED',
      recordType: FundingRecordType.PAYMENT_INSTRUCTIONS, recordId: r.id,
      details: { after: instructionDto(r) },
    });
    return r;
  });
  return instructionDto(row);
}

export async function adminUpdateInstruction(adminId: string, id: string, body: any) {
  requireConfirm(body);
  const reason = reqString(body?.reason, 'Reason for change', 3, 300);
  const data = validateInstruction(body, true) as any;
  const existing = await prisma.paymentInstructions.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Payment instructions not found.');
  const row = await prisma.$transaction(async (tx) => {
    const r = await tx.paymentInstructions.update({ where: { id }, data: { ...data, updatedByUserId: adminId } });
    await writeAudit(tx, {
      actorId: adminId, action: 'PAYMENT_INSTRUCTIONS_UPDATED',
      recordType: FundingRecordType.PAYMENT_INSTRUCTIONS, recordId: id, reason,
      details: { before: instructionDto(existing), after: instructionDto(r) },
    });
    return r;
  });
  return instructionDto(row);
}

export async function hasActiveInstructions(): Promise<boolean> {
  return (await prisma.paymentInstructions.count({ where: { active: true } })) > 0;
}