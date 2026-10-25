import { Prisma, FundingStatus, DeclarationStatus, FundingRecordType } from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { ethTodayFromInstant } from '../utils/ethiopianCalendar';
import { formatEtb } from '../utils/money';
import { writeAudit } from './funding.audit';
import {
  getCurrentConfig, configDto, eligibleWhere, ensureRecordsForConfig,
  listActiveInstructions, hasActiveInstructions, adminUpsertConfig, previewDeadline,
} from './funding.config.service';
import { dateDto, moneyDto, declarationDto, progressDto, isPastDeadline } from './funding.dto';
import { reqString, optString, pageParams, reqPaymentMethod, reqAmountMinor } from './funding.validation';
import { notifyLeadersVerificationNeeded, notifyMemberResult } from './funding.notify';
import { memberCampaignItems } from './campaign.service';

const REC_TYPE = 'AnnualContributionRecord' as const;

function recordLabel(year: number) {
  return `the ${year} E.C. annual hosting contribution`;
}

function pendingOf(decls: { status: DeclarationStatus; amountMinor: number }[]) {
  const pending = decls.filter((d) => d.status === DeclarationStatus.PENDING);
  if (pending.length === 0) return null;
  return {
    count: pending.length,
    totalMinor: pending.reduce((s, d) => s + d.amountMinor, 0),
  };
}

export async function getMyFunding(userId: string) {
  const config = await getCurrentConfig();
  const instructions = await listActiveInstructions();

  let current = null as Awaited<ReturnType<typeof loadMyRecord>> | null;
  if (config) {
    const eligible = await prisma.user.count({ where: { id: userId, ...eligibleWhere(config) } });
    if (eligible) {
      await prisma.annualContributionRecord.createMany({
        data: [{ configId: config.id, participantId: userId, contributionYear: config.contributionYear, amountDueMinor: config.amountMinor }],
        skipDuplicates: true,
      });
    }
    current = await loadMyRecord(userId, config.contributionYear);
  }

  const past = await prisma.annualContributionRecord.findMany({
    where: { participantId: userId, ...(config ? { contributionYear: { not: config.contributionYear } } : {}) },
    orderBy: { contributionYear: 'desc' },
    take: 10,
    select: { id: true, contributionYear: true, amountDueMinor: true, paidMinor: true, status: true, verifiedAt: true },
  });

  const hasInstr = instructions.length > 0;
  const campaigns = await memberCampaignItems(userId, hasInstr);

  return {
    annual: config && current
      ? (() => {
          const p = pendingOf(current.declarations);
          return {
            config: configDto(config),
            record: {
              id: current.id,
              contributionYear: current.contributionYear,
              amountDue: moneyDto(current.amountDueMinor),
              progress: progressDto(current.paidMinor, current.amountDueMinor),
              status: current.status,
              pendingAmount: p ? moneyDto(p.totalMinor) : null,
              pendingCount: p ? p.count : 0,
              rejectionReason: current.status === FundingStatus.REJECTED ? current.rejectionReason : null,
              verifiedAt: current.verifiedAt,
              deadline: dateDto(config.deadlineGregorian),
              deadlinePassed: isPastDeadline(config.deadlineGregorian),
              canDeclare:
                config.active && hasInstr &&
                current.status !== FundingStatus.PAID &&
                current.paidMinor < current.amountDueMinor,
            },
            history: current.declarations.map(declarationDto),
          };
        })()
      : null,
    notEligible: !!config && !current,
    instructions,
    paymentInstructionsMissing: !hasInstr,
    campaigns,
    pastYears: past.map((p) => ({
      id: p.id, contributionYear: p.contributionYear,
      amountDue: moneyDto(p.amountDueMinor), progress: progressDto(p.paidMinor, p.amountDueMinor),
      status: p.status, verifiedAt: p.verifiedAt,
    })),
  };
}

async function loadMyRecord(userId: string, year: number) {
  return prisma.annualContributionRecord.findUnique({
    where: { participantId_contributionYear: { participantId: userId, contributionYear: year } },
    include: { declarations: { orderBy: { declaredAt: 'desc' }, take: 50 } },
  });
}

export async function declareAnnualPayment(userId: string, recordId: string, body: any) {
  const clientId = optString(body?.clientId, 'clientId', 64);
  const rawRef = optString(body?.reference, 'Reference', 100);
  const paymentMethod = reqPaymentMethod(body?.paymentMethod);
  const amountMinor = reqAmountMinor(body?.amountMinor);

  if (clientId) {
    const prior = await prisma.fundingDeclaration.findUnique({
      where: { participantId_clientId: { participantId: userId, clientId } },
    });
    if (prior) return { declaration: declarationDto(prior), idempotent: true };
  }

  const record = await prisma.annualContributionRecord.findUnique({
    where: { id: recordId },
    include: {
      config: true,
      participant: { select: { memberProfile: { select: { fullName: true } }, phone: true } },
      declarations: { where: { status: DeclarationStatus.PENDING }, select: { amountMinor: true } },
    },
  });
  if (!record || record.participantId !== userId) throw ApiError.notFound('Record not found.');
  if (!record.config.active) throw ApiError.conflict('This contribution year is not active.', 'FUNDING_INACTIVE');
  if (!(await hasActiveInstructions())) {
    throw ApiError.badRequest('Payment instructions are not available yet. Please try again later.', 'NO_PAYMENT_INSTRUCTIONS');
  }

  const reference = record.config.referenceEnabled ? rawRef : null;
  const late = isPastDeadline(record.config.deadlineGregorian);

  try {
    const decl = await prisma.$transaction(async (tx) => {
      const fresh = await tx.annualContributionRecord.findUnique({
        where: { id: recordId },
        include: { declarations: { where: { status: DeclarationStatus.PENDING }, select: { amountMinor: true } } },
      });
      if (!fresh || fresh.participantId !== userId) throw ApiError.notFound('Record not found.');
      if (fresh.status === FundingStatus.PAID) {
        throw ApiError.conflict('This contribution is already fully paid.', 'ALREADY_PAID');
      }

      const pendingTotal = fresh.declarations.reduce((s, d) => s + d.amountMinor, 0);
      const remaining = fresh.amountDueMinor - fresh.paidMinor - pendingTotal;
      if (remaining <= 0) {
        throw ApiError.conflict(
          'You already have declarations covering the full balance. Wait for them to be verified or adjust.',
          'PENDING_COVERS_BALANCE',
        );
      }
      if (amountMinor > remaining) {
        throw ApiError.badRequest(
          `The amount is more than your remaining balance after pending declarations (${formatEtb(remaining)}).`,
          'AMOUNT_EXCEEDS_REMAINING',
        );
      }

      const nextStatus = FundingStatus.PENDING_VERIFICATION;
      const moved = await tx.annualContributionRecord.updateMany({
        where: { id: recordId, participantId: userId, version: fresh.version },
        data: { status: nextStatus, rejectionReason: null, version: { increment: 1 } },
      });
      if (moved.count === 0) throw ApiError.conflict('This payment changed. Please refresh and try again.', 'STALE_RECORD');

      const d = await tx.fundingDeclaration.create({
        data: { annualRecordId: recordId, participantId: userId, amountMinor, paymentMethod, reference, clientId },
      });
      await writeAudit(tx, {
        actorId: userId, action: 'DECLARED', recordType: FundingRecordType.ANNUAL, recordId,
        previousStatus: fresh.status, newStatus: FundingStatus.PENDING_VERIFICATION,
        details: { declarationId: d.id, amountMinor, paymentMethod, late, paidBefore: fresh.paidMinor, pendingBefore: pendingTotal },
      });
      return d;
    });

    void notifyLeadersVerificationNeeded({
      declarerId: userId,
      declarerName: record.participant.memberProfile?.fullName ?? record.participant.phone,
      recordType: REC_TYPE, recordId, what: recordLabel(record.contributionYear),
    });
    return { declaration: declarationDto(decl), idempotent: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw ApiError.conflict('This payment was already declared.', 'ALREADY_DECLARED');
    }
    throw e;
  }
}

export async function leaderGetAnnualConfig() {
  const c = await getCurrentConfig();
  return c ? configDto(c) : null;
}

export { previewDeadline as leaderPreviewDeadline };

export async function leaderUpsertAnnualConfig(leaderId: string, body: any) {
  return adminUpsertConfig(leaderId, body);
}

export async function leaderListAnnual(q: Record<string, unknown>) {
  const config = await getCurrentConfig();
  const year = Number(q.year) || config?.contributionYear;
  if (!year) return { year: null, items: [], total: 0, counts: zeroCounts(), totals: null };

  const { page, pageSize, skip } = pageParams(q);
  const status = typeof q.status === 'string' && q.status in FundingStatus ? (q.status as FundingStatus) : undefined;
  const search = typeof q.q === 'string' ? q.q.trim().slice(0, 80) : '';

  const where: Prisma.AnnualContributionRecordWhereInput = {
    contributionYear: year,
    ...(status ? { status } : {}),
    ...(search ? { participant: { memberProfile: { fullName: { contains: search, mode: 'insensitive' } } } } : {}),
  };

  const [items, total, grouped, allAgg, activeAgg] = await Promise.all([
    prisma.annualContributionRecord.findMany({
      where, skip, take: pageSize,
      orderBy: { updatedAt: 'desc' },
      include: {
        participant: { select: { id: true, phone: true, role: true, memberProfile: { select: { fullName: true, profilePhotoUrl: true } } } },
        declarations: { orderBy: { declaredAt: 'desc' }, take: 5 },
        config: { select: { deadlineGregorian: true } },
      },
    }),
    prisma.annualContributionRecord.count({ where }),
    prisma.annualContributionRecord.groupBy({ by: ['status'], where: { contributionYear: year }, _count: { _all: true } }),
    prisma.annualContributionRecord.aggregate({ where: { contributionYear: year }, _sum: { paidMinor: true } }),
    prisma.annualContributionRecord.aggregate({
      where: { contributionYear: year, participant: { status: 'APPROVED', deletedAt: null } },
      _sum: { amountDueMinor: true, paidMinor: true }, _count: { _all: true },
    }),
  ]);

  const counts = zeroCounts();
  for (const g of grouped) counts[g.status] = g._count._all;

  const expected = activeAgg._sum.amountDueMinor ?? 0;
  const activePaid = activeAgg._sum.paidMinor ?? 0;

  return {
    year, page, pageSize, total,
    counts,
    totals: {
      received: moneyDto(allAgg._sum.paidMinor ?? 0),
      outstanding: moneyDto(Math.max(0, expected - activePaid)),
      expected: moneyDto(expected),
      eligibleParticipants: activeAgg._count._all,
    },
    items: items.map((r) => {
      const pending = r.declarations.filter((d) => d.status === DeclarationStatus.PENDING);
      return {
        id: r.id,
        type: 'ANNUAL' as const,
        contributionYear: r.contributionYear,
        status: r.status,
        amountDue: moneyDto(r.amountDueMinor),
        progress: progressDto(r.paidMinor, r.amountDueMinor),
        deadline: dateDto(r.config.deadlineGregorian),
        participant: {
          id: r.participant.id,
          fullName: r.participant.memberProfile?.fullName ?? r.participant.phone,
          photoUrl: r.participant.memberProfile?.profilePhotoUrl ?? null,
          role: r.participant.role,
        },
        verifiedAt: r.verifiedAt,
        verifiedByUserId: r.verifiedByUserId,
        rejectionReason: r.rejectionReason,
        latestDeclaration: r.declarations[0] ? declarationDto(r.declarations[0]) : null,
        pendingCount: pending.length,
        pendingTotal: pending.length
          ? moneyDto(pending.reduce((s, d) => s + d.amountMinor, 0))
          : null,
      };
    }),
  };
}

function zeroCounts(): Record<FundingStatus, number> {
  return { UNPAID: 0, PENDING_VERIFICATION: 0, PAID: 0, REJECTED: 0 };
}

export async function leaderGetAnnual(recordId: string) {
  const r = await prisma.annualContributionRecord.findUnique({
    where: { id: recordId },
    include: {
      participant: { select: { id: true, phone: true, memberProfile: { select: { fullName: true, profilePhotoUrl: true } } } },
      declarations: {
        orderBy: { declaredAt: 'desc' }, take: 50,
        include: { decidedBy: { select: { memberProfile: { select: { fullName: true } } } } },
      },
      config: { select: { deadlineGregorian: true } },
    },
  });
  if (!r) throw ApiError.notFound('Record not found.');
  return {
    id: r.id, contributionYear: r.contributionYear, status: r.status,
    amountDue: moneyDto(r.amountDueMinor), progress: progressDto(r.paidMinor, r.amountDueMinor),
    deadline: dateDto(r.config.deadlineGregorian),
    participant: {
      id: r.participant.id,
      fullName: r.participant.memberProfile?.fullName ?? r.participant.phone,
      photoUrl: r.participant.memberProfile?.profilePhotoUrl ?? null,
    },
    history: r.declarations.map((d) => ({
      ...declarationDto(d),
      decidedByName: d.decidedBy?.memberProfile?.fullName ?? null,
    })),
  };
}

export async function approveAnnual(recordId: string, leaderId: string, body?: any) {
  const declarationId = optString(body?.declarationId, 'declarationId', 64);

  const rec = await prisma.annualContributionRecord.findUnique({ where: { id: recordId } });
  if (!rec) throw ApiError.notFound('Record not found.');
  if (rec.participantId === leaderId) {
    throw ApiError.forbidden('You cannot verify your own payment. Another leader must do it.', 'SELF_VERIFICATION');
  }
  const now = new Date();

  const out = await prisma.$transaction(async (tx) => {
    const decl = await tx.fundingDeclaration.findFirst({
      where: { annualRecordId: recordId, status: DeclarationStatus.PENDING, ...(declarationId ? { id: declarationId } : {}) },
      orderBy: { declaredAt: 'asc' },
    });
    const fresh = await tx.annualContributionRecord.findUnique({ where: { id: recordId } });
    if (!decl || !fresh || fresh.status !== FundingStatus.PENDING_VERIFICATION) {
      throw ApiError.conflict('This payment was already processed by someone else.', 'ALREADY_PROCESSED');
    }

    const claimed = await tx.fundingDeclaration.updateMany({
      where: { id: decl.id, status: DeclarationStatus.PENDING },
      data: { status: DeclarationStatus.APPROVED, decidedByUserId: leaderId, decidedAt: now },
    });
    if (claimed.count !== 1) {
      throw ApiError.conflict('This payment was already processed by someone else.', 'ALREADY_PROCESSED');
    }

    const paidMinor = fresh.paidMinor + decl.amountMinor;

    const stillPending = await tx.fundingDeclaration.count({
      where: { annualRecordId: recordId, status: DeclarationStatus.PENDING },
    });
    let status: FundingStatus;
    if (stillPending > 0) {
      status = FundingStatus.PENDING_VERIFICATION;
    } else if (paidMinor >= fresh.amountDueMinor) {
      status = FundingStatus.PAID;
    } else {
      status = FundingStatus.UNPAID;
    }

    const moved = await tx.annualContributionRecord.updateMany({
      where: { id: recordId, version: fresh.version },
      data: { status, paidMinor, verifiedByUserId: leaderId, verifiedAt: now, rejectionReason: null, version: { increment: 1 } },
    });
    if (moved.count !== 1) {
      throw ApiError.conflict('This payment was already processed by someone else.', 'ALREADY_PROCESSED');
    }

    await writeAudit(tx, {
      actorId: leaderId, action: 'APPROVED', recordType: FundingRecordType.ANNUAL, recordId,
      previousStatus: FundingStatus.PENDING_VERIFICATION, newStatus: status,
      details: { declarationId: decl.id, amountMinor: decl.amountMinor, paymentMethod: decl.paymentMethod, paidMinor, stillPending },
    });
    return { status, paidMinor, amountMinor: decl.amountMinor, due: fresh.amountDueMinor, stillPending };
  });

  const remaining = Math.max(0, out.due - out.paidMinor);
  void notifyMemberResult({
    memberId: rec.participantId, approved: true, what: recordLabel(rec.contributionYear),
    amountLabel: formatEtb(out.amountMinor), remainingLabel: remaining > 0 ? formatEtb(remaining) : null,
    recordType: REC_TYPE, recordId,
  });
  return { ok: true, status: out.status, verifiedAt: now, progress: progressDto(out.paidMinor, out.due), stillPending: out.stillPending };
}

export async function rejectAnnual(recordId: string, leaderId: string, body: any) {
  const reason = reqString(body?.reason, 'Rejection reason', 3, 500);
  const declarationId = optString(body?.declarationId, 'declarationId', 64);
  const rec = await prisma.annualContributionRecord.findUnique({ where: { id: recordId } });
  if (!rec) throw ApiError.notFound('Record not found.');
  if (rec.participantId === leaderId) {
    throw ApiError.forbidden('You cannot process your own payment. Another leader must do it.', 'SELF_VERIFICATION');
  }
  const now = new Date();

  const declared = await prisma.$transaction(async (tx) => {
    const decl = await tx.fundingDeclaration.findFirst({
      where: { annualRecordId: recordId, status: DeclarationStatus.PENDING, ...(declarationId ? { id: declarationId } : {}) },
      orderBy: { declaredAt: 'asc' },
    });
    if (!decl) throw ApiError.conflict('This payment was already processed by someone else.', 'ALREADY_PROCESSED');

    const claimed = await tx.fundingDeclaration.updateMany({
      where: { id: decl.id, status: DeclarationStatus.PENDING },
      data: { status: DeclarationStatus.REJECTED, decidedByUserId: leaderId, decidedAt: now, rejectionReason: reason },
    });
    if (claimed.count !== 1) {
      throw ApiError.conflict('This payment was already processed by someone else.', 'ALREADY_PROCESSED');
    }

    const stillPending = await tx.fundingDeclaration.count({
      where: { annualRecordId: recordId, status: DeclarationStatus.PENDING },
    });
    const nextStatus = stillPending > 0 ? FundingStatus.PENDING_VERIFICATION : FundingStatus.REJECTED;
    const moved = await tx.annualContributionRecord.updateMany({
      where: { id: recordId, status: FundingStatus.PENDING_VERIFICATION },
      data: { status: nextStatus, rejectionReason: stillPending > 0 ? null : reason, version: { increment: 1 } },
    });
    if (moved.count !== 1) {
      throw ApiError.conflict('This payment was already processed by someone else.', 'ALREADY_PROCESSED');
    }
    await writeAudit(tx, {
      actorId: leaderId, action: 'REJECTED', recordType: FundingRecordType.ANNUAL, recordId,
      previousStatus: FundingStatus.PENDING_VERIFICATION, newStatus: nextStatus, reason,
      details: { declarationId: decl.id, amountMinor: decl.amountMinor, stillPending },
    });
    return { decl, stillPending };
  });

  void notifyMemberResult({
    memberId: rec.participantId, approved: false, reason, what: recordLabel(rec.contributionYear),
    amountLabel: formatEtb(declared.decl.amountMinor), recordType: REC_TYPE, recordId,
  });
  return { ok: true, status: declared.stillPending > 0 ? FundingStatus.PENDING_VERIFICATION : FundingStatus.REJECTED, stillPending: declared.stillPending };
}

export async function adminCorrectAnnual(recordId: string, adminId: string, body: any) {
  const reason = reqString(body?.reason, 'Reason for correction', 5, 500);
  const declarationId = optString(body?.declarationId, 'declarationId', 64);
  const now = new Date();

  const out = await prisma.$transaction(async (tx) => {
    const rec = await tx.annualContributionRecord.findUnique({ where: { id: recordId } });
    if (!rec) throw ApiError.notFound('Record not found.');
    if (rec.status === FundingStatus.PENDING_VERIFICATION) {
      throw ApiError.conflict('Resolve the pending declaration first.', 'PENDING_EXISTS');
    }
    const decl = await tx.fundingDeclaration.findFirst({
      where: { annualRecordId: recordId, status: DeclarationStatus.APPROVED, ...(declarationId ? { id: declarationId } : {}) },
      orderBy: { decidedAt: 'desc' },
    });
    if (!decl) throw ApiError.conflict('There is no approved payment to correct.', 'NOT_PAID');

    const voided = await tx.fundingDeclaration.updateMany({
      where: { id: decl.id, status: DeclarationStatus.APPROVED },
      data: { status: DeclarationStatus.VOID, decidedAt: now, rejectionReason: `Corrected: ${reason}` },
    });
    if (voided.count !== 1) throw ApiError.conflict('Already corrected.', 'ALREADY_PROCESSED');

    const paidMinor = Math.max(0, rec.paidMinor - decl.amountMinor);
    const moved = await tx.annualContributionRecord.updateMany({
      where: { id: recordId, version: rec.version, status: { not: FundingStatus.PENDING_VERIFICATION } },
      data: { status: FundingStatus.UNPAID, paidMinor, verifiedByUserId: null, verifiedAt: null, version: { increment: 1 } },
    });
    if (moved.count !== 1) throw ApiError.conflict('The record changed. Please retry.', 'STALE_RECORD');

    await writeAudit(tx, {
      actorId: adminId, action: 'CORRECTED', recordType: FundingRecordType.ANNUAL, recordId,
      previousStatus: rec.status, newStatus: FundingStatus.UNPAID, reason,
      details: { declarationId: decl.id, amountMinor: decl.amountMinor, paidMinor },
    });
    return { paidMinor, due: rec.amountDueMinor };
  });
  return { ok: true, status: FundingStatus.UNPAID, progress: progressDto(out.paidMinor, out.due) };
}

export async function adminListAudit(q: Record<string, unknown>) {
  const { page, pageSize, skip } = pageParams(q, 100);
  const where: Prisma.FundingAuditLogWhereInput = {
    ...(typeof q.recordId === 'string' ? { recordId: q.recordId } : {}),
    ...(typeof q.action === 'string' ? { action: q.action } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.fundingAuditLog.findMany({
      where, skip, take: pageSize, orderBy: { createdAt: 'desc' },
      include: { actor: { select: { role: true, memberProfile: { select: { fullName: true } } } } },
    }),
    prisma.fundingAuditLog.count({ where }),
  ]);
  return {
    page, pageSize, total,
    items: items.map((a) => ({
      id: a.id, action: a.action, recordType: a.recordType, recordId: a.recordId,
      previousStatus: a.previousStatus, newStatus: a.newStatus, reason: a.reason,
      details: a.details, createdAt: a.createdAt,
      actorRole: a.actor?.role ?? null, actorName: a.actor?.memberProfile?.fullName ?? null,
    })),
  };
}

export { ensureRecordsForConfig, ethTodayFromInstant };