import {
  Prisma, FundingRecordType, CampaignStatus, DonationType, FundingStatus,
  DeclarationStatus, NotificationType, UserRole,
  SpecialDonationCampaign, SpecialDonationPayment,
} from '@prisma/client';
import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { ethToUtcDate } from '../utils/ethiopianCalendar';
import { formatEtb } from '../utils/money';
import { writeAudit } from './funding.audit';
import { dateDto, moneyDto, declarationDto, progressDto, isPastDeadline } from './funding.dto';
import {
  reqString, optString, optInt, reqEthDate, reqPaymentMethod, reqAmountMinor, pageParams,
} from './funding.validation';
import { notifyLeadersVerificationNeeded, notifyMemberResult } from './funding.notify';
import { listActiveInstructions, hasActiveInstructions } from './funding.config.service';
import { fanOut } from '../notifications/notifications.service';

const REC_TYPE = 'SpecialDonationPayment' as const;

function dueOf(c: { donationType: DonationType; requestedAmountMinor: number | null }): number | null {
  return c.donationType === DonationType.REQUIRED ? c.requestedAmountMinor : null;
}

function settledStatus(c: { donationType: DonationType; requestedAmountMinor: number | null }, paidMinor: number): FundingStatus {
  const due = dueOf(c);
  if (due === null) return paidMinor > 0 ? FundingStatus.PAID : FundingStatus.UNPAID;
  return paidMinor >= due ? FundingStatus.PAID : FundingStatus.UNPAID;
}

async function receivedByCampaign(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const g = await prisma.specialDonationPayment.groupBy({
    by: ['campaignId'], where: { campaignId: { in: ids } }, _sum: { paidMinor: true },
  });
  return new Map(g.map((r) => [r.campaignId, r._sum.paidMinor ?? 0]));
}

function memberCampaignDto(
  c: SpecialDonationCampaign,
  my: SpecialDonationPayment | undefined,
  received: number,
  hasInstructions: boolean,
  pending: { count: number; totalMinor: number },
) {
  const due = dueOf(c);
  const paid = my?.paidMinor ?? 0;
  const status = my?.status ?? FundingStatus.UNPAID;
  const past = isPastDeadline(c.deadlineDate);
  const fullyPaid = due !== null && paid >= due;
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    donationType: c.donationType,
    status: c.status,
    requestedAmount: c.requestedAmountMinor ? moneyDto(c.requestedAmountMinor) : null,
    targetAmount: c.targetAmountMinor ? moneyDto(c.targetAmountMinor) : null,
    deadline: dateDto(c.deadlineDate),
    deadlinePassed: past,
    imageUrl: c.imageUrl,
    campaignProgress: progressDto(received, c.targetAmountMinor),
    my: {
      status,
      progress: progressDto(paid, due),
      pendingAmount: pending.count > 0 ? moneyDto(pending.totalMinor) : null,
      pendingCount: pending.count,
      rejectionReason: status === FundingStatus.REJECTED ? my?.rejectionReason ?? null : null,
      // v2.1: pending declarations don't block new ones; only a fully paid balance does.
      canDeclare:
        c.status === CampaignStatus.PUBLISHED && !past && hasInstructions && !fullyPaid,
    },
  };
}

// ============================================================
// Leader: campaign management (unchanged from v2 — copy from existing)
// ============================================================

function parseCampaignFields(src: any) {
  const title = reqString(src?.title, 'Title', 3, 120);
  const description = reqString(src?.description, 'Description', 10, 2000);
  if (src?.donationType !== 'REQUIRED' && src?.donationType !== 'VOLUNTARY') {
    throw ApiError.badRequest('Donation type must be REQUIRED or VOLUNTARY.');
  }
  const donationType = src.donationType as DonationType;
  const requestedAmountMinor = optInt(src.requestedAmountMinor, 'Requested amount', 100, 1_000_000_000);
  const targetAmountMinor = optInt(src.targetAmountMinor, 'Target amount', 100, 1_000_000_000);
  if (donationType === DonationType.REQUIRED && requestedAmountMinor === null) {
    throw ApiError.badRequest('A required donation must have a fixed amount per person.', 'REQUIRED_AMOUNT_MISSING');
  }
  if (requestedAmountMinor !== null && targetAmountMinor !== null && requestedAmountMinor > targetAmountMinor) {
    throw ApiError.badRequest('The per-person amount cannot be more than the overall target.');
  }
  const deadlineEth = reqEthDate(src?.deadline, 'Deadline');
  return { title, description, donationType, requestedAmountMinor, targetAmountMinor, deadlineEth };
}

type CampaignFields = ReturnType<typeof parseCampaignFields>;

function campaignData(f: CampaignFields) {
  return {
    title: f.title, description: f.description, donationType: f.donationType,
    requestedAmountMinor: f.requestedAmountMinor, targetAmountMinor: f.targetAmountMinor,
    deadlineEthYear: f.deadlineEth.year, deadlineEthMonth: f.deadlineEth.month, deadlineEthDay: f.deadlineEth.day,
    deadlineDate: ethToUtcDate(f.deadlineEth),
  };
}

function campaignSnapshot(c: SpecialDonationCampaign) {
  return {
    title: c.title, description: c.description, donationType: c.donationType,
    requestedAmountMinor: c.requestedAmountMinor, targetAmountMinor: c.targetAmountMinor,
    deadline: { y: c.deadlineEthYear, m: c.deadlineEthMonth, d: c.deadlineEthDay },
    status: c.status,
  } satisfies Prisma.InputJsonValue;
}

export async function leaderCreateCampaign(leaderId: string, body: any) {
  const f = parseCampaignFields(body);
  const data = campaignData(f);
  if (isPastDeadline(data.deadlineDate)) throw ApiError.badRequest('The deadline cannot be in the past.', 'DEADLINE_IN_PAST');

  const campaign = await prisma.$transaction(async (tx) => {
    const c = await tx.specialDonationCampaign.create({
      data: { ...data, status: CampaignStatus.DRAFT, createdByUserId: leaderId },
    });
    await writeAudit(tx, {
      actorId: leaderId, action: 'CAMPAIGN_CREATED', recordType: FundingRecordType.CAMPAIGN, recordId: c.id,
      newStatus: CampaignStatus.DRAFT, details: { after: campaignSnapshot(c) },
    });
    return c;
  });
  return { id: campaign.id };
}

export async function leaderUpdateCampaign(campaignId: string, leaderId: string, body: any) {
  const c = await prisma.specialDonationCampaign.findUnique({ where: { id: campaignId } });
  if (!c) throw ApiError.notFound('Campaign not found.');
  if (c.status !== CampaignStatus.DRAFT && c.status !== CampaignStatus.PUBLISHED) {
    throw ApiError.conflict('Closed or cancelled campaigns cannot be edited.', 'CAMPAIGN_LOCKED');
  }

  const f = parseCampaignFields({
    title: body?.title ?? c.title,
    description: body?.description ?? c.description,
    donationType: body?.donationType ?? c.donationType,
    requestedAmountMinor: body?.requestedAmountMinor !== undefined ? body.requestedAmountMinor : c.requestedAmountMinor,
    targetAmountMinor: body?.targetAmountMinor !== undefined ? body.targetAmountMinor : c.targetAmountMinor,
    deadline: body?.deadline ?? { year: c.deadlineEthYear, month: c.deadlineEthMonth, day: c.deadlineEthDay },
  });
  const data = campaignData(f);

  let reason: string | null = null;
  if (c.status === CampaignStatus.PUBLISHED) {
    if (f.donationType !== c.donationType || f.requestedAmountMinor !== c.requestedAmountMinor) {
      throw ApiError.conflict(
        'The donation type and per-person amount cannot change after publishing.', 'CAMPAIGN_FIELDS_LOCKED',
      );
    }
    reason = reqString(body?.reason, 'Reason for change', 3, 300);
  }
  if (data.deadlineDate.getTime() !== c.deadlineDate.getTime() && isPastDeadline(data.deadlineDate)) {
    throw ApiError.badRequest('The deadline cannot be in the past.', 'DEADLINE_IN_PAST');
  }

  await prisma.$transaction(async (tx) => {
    const moved = await tx.specialDonationCampaign.updateMany({
      where: { id: campaignId, status: c.status }, data,
    });
    if (moved.count !== 1) throw ApiError.conflict('The campaign changed. Please refresh.', 'STALE_CAMPAIGN');
    await writeAudit(tx, {
      actorId: leaderId, action: 'CAMPAIGN_UPDATED', recordType: FundingRecordType.CAMPAIGN, recordId: campaignId,
      previousStatus: c.status, newStatus: c.status, reason,
      details: {
        before: campaignSnapshot(c),
        after: {
          title: f.title, description: f.description, donationType: f.donationType,
          requestedAmountMinor: f.requestedAmountMinor, targetAmountMinor: f.targetAmountMinor,
          deadline: { y: f.deadlineEth.year, m: f.deadlineEth.month, d: f.deadlineEth.day },
          status: c.status,
        },
      },
    });
  });
  return { ok: true };
}

export async function leaderListCampaigns(_leaderId: string) {
  const rows = await prisma.specialDonationCampaign.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  const ids = rows.map((r) => r.id);
  const [received, pending] = await Promise.all([
    receivedByCampaign(ids),
    ids.length
      ? prisma.specialDonationPayment.groupBy({
          by: ['campaignId'],
          where: { campaignId: { in: ids }, status: FundingStatus.PENDING_VERIFICATION },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const pendingMap = new Map(pending.map((p) => [p.campaignId, p._count._all]));

  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    donationType: c.donationType,
    deadline: dateDto(c.deadlineDate),
    requestedAmount: c.requestedAmountMinor ? moneyDto(c.requestedAmountMinor) : null,
    targetAmount: c.targetAmountMinor ? moneyDto(c.targetAmountMinor) : null,
    progress: progressDto(received.get(c.id) ?? 0, c.targetAmountMinor),
    pendingCount: pendingMap.get(c.id) ?? 0,
  }));
}

export async function leaderPublishCampaign(campaignId: string, leaderId: string) {
  const c = await prisma.specialDonationCampaign.findUnique({ where: { id: campaignId } });
  if (!c) throw ApiError.notFound('Campaign not found.');
  if (c.status !== CampaignStatus.DRAFT) throw ApiError.badRequest('Only draft campaigns can be published.');
  if (isPastDeadline(c.deadlineDate)) throw ApiError.badRequest('Cannot publish a campaign whose deadline has passed.');
  if (!(await hasActiveInstructions())) {
    throw ApiError.badRequest(
      'Add the official Bank/Telebirr payment details before publishing a campaign.', 'NO_PAYMENT_INSTRUCTIONS',
    );
  }

  await prisma.$transaction(async (tx) => {
    const moved = await tx.specialDonationCampaign.updateMany({
      where: { id: campaignId, status: CampaignStatus.DRAFT },
      data: { status: CampaignStatus.PUBLISHED, publishedAt: new Date() },
    });
    if (moved.count !== 1) throw ApiError.conflict('The campaign changed. Please refresh.', 'STALE_CAMPAIGN');
    await writeAudit(tx, {
      actorId: leaderId, action: 'CAMPAIGN_PUBLISHED', recordType: FundingRecordType.CAMPAIGN, recordId: campaignId,
      previousStatus: CampaignStatus.DRAFT, newStatus: CampaignStatus.PUBLISHED,
    });
  });

  const members = await prisma.user.findMany({
    where: { role: { in: [UserRole.MEMBER, UserRole.LEADER] }, status: 'APPROVED', deletedAt: null },
    select: { id: true },
  });
  void fanOut({
    recipients: members.map((m) => m.id),
    type: NotificationType.FUNDING_CAMPAIGN,
    title: 'New Special Donation',
    body: `A new campaign "${c.title}" is now open.`,
    relatedEntityType: 'SpecialDonationCampaign',
    relatedEntityId: campaignId,
  });
  return { ok: true };
}

export async function leaderCloseCampaign(campaignId: string, leaderId: string) {
  await prisma.$transaction(async (tx) => {
    const moved = await tx.specialDonationCampaign.updateMany({
      where: { id: campaignId, status: CampaignStatus.PUBLISHED },
      data: { status: CampaignStatus.CLOSED, closedAt: new Date() },
    });
    if (moved.count !== 1) throw ApiError.badRequest('Only published campaigns can be closed.');
    await writeAudit(tx, {
      actorId: leaderId, action: 'CAMPAIGN_CLOSED', recordType: FundingRecordType.CAMPAIGN, recordId: campaignId,
      previousStatus: CampaignStatus.PUBLISHED, newStatus: CampaignStatus.CLOSED,
    });
  });
  return { ok: true };
}

export async function leaderCancelCampaign(campaignId: string, leaderId: string, body: any) {
  const reason = reqString(body?.reason, 'Reason for cancelling', 3, 300);
  const c = await prisma.specialDonationCampaign.findUnique({ where: { id: campaignId } });
  if (!c) throw ApiError.notFound('Campaign not found.');
  if (c.status !== CampaignStatus.DRAFT && c.status !== CampaignStatus.PUBLISHED) {
    throw ApiError.conflict('Only draft or published campaigns can be cancelled.', 'CAMPAIGN_LOCKED');
  }
  const now = new Date();

  const affected = await prisma.$transaction(async (tx) => {
    const moved = await tx.specialDonationCampaign.updateMany({
      where: { id: campaignId, status: c.status },
      data: { status: CampaignStatus.CANCELLED, cancelledAt: now },
    });
    if (moved.count !== 1) throw ApiError.conflict('The campaign changed. Please refresh.', 'STALE_CAMPAIGN');

    const pending = await tx.specialDonationPayment.findMany({
      where: { campaignId, status: FundingStatus.PENDING_VERIFICATION },
    });
    for (const p of pending) {
      await tx.fundingDeclaration.updateMany({
        where: { donationPaymentId: p.id, status: DeclarationStatus.PENDING },
        data: { status: DeclarationStatus.VOID, decidedByUserId: leaderId, decidedAt: now, rejectionReason: 'Campaign cancelled' },
      });
      await tx.specialDonationPayment.update({
        where: { id: p.id },
        data: { status: settledStatus(c, p.paidMinor), rejectionReason: null, version: { increment: 1 } },
      });
    }
    await writeAudit(tx, {
      actorId: leaderId, action: 'CAMPAIGN_CANCELLED', recordType: FundingRecordType.CAMPAIGN, recordId: campaignId,
      previousStatus: c.status, newStatus: CampaignStatus.CANCELLED, reason,
      details: { voidedPendingDeclarations: pending.length },
    });
    return pending.map((p) => p.participantId);
  });

  if (affected.length > 0) {
    void fanOut({
      recipients: affected, type: NotificationType.FUNDING_RESULT,
      title: 'Campaign cancelled',
      body: `"${c.title}" was cancelled. Your pending payment declaration was voided; please do not send further payments.`,
      relatedEntityType: 'SpecialDonationCampaign', relatedEntityId: campaignId, force: true,
    });
  }
  return { ok: true, voidedPending: affected.length };
}

// ============================================================
// Member: view & declare
// ============================================================

export async function memberCampaignItems(userId: string, hasInstructions: boolean) {
  const campaigns = await prisma.specialDonationCampaign.findMany({
    where: {
      OR: [
        { status: CampaignStatus.PUBLISHED },
        { status: { in: [CampaignStatus.CLOSED, CampaignStatus.CANCELLED] }, payments: { some: { participantId: userId } } },
      ],
    },
    orderBy: { deadlineDate: 'asc' },
    take: 50,
    include: {
      payments: { where: { participantId: userId }, include: { declarations: { where: { status: DeclarationStatus.PENDING } } } },
    },
  });

  const visible = campaigns.filter(
    (c) => !(c.status === CampaignStatus.PUBLISHED && isPastDeadline(c.deadlineDate) && c.payments.length === 0),
  );
  const received = await receivedByCampaign(visible.map((c) => c.id));
  return visible.map((c) => {
    const my = c.payments[0];
    const pendingDecls = my?.declarations ?? [];
    const pending = {
      count: pendingDecls.length,
      totalMinor: pendingDecls.reduce((s, d) => s + d.amountMinor, 0),
    };
    return memberCampaignDto(c, my, received.get(c.id) ?? 0, hasInstructions, pending);
  });
}

export async function getActiveCampaigns(userId: string) {
  const instructions = await listActiveInstructions();
  const items = await memberCampaignItems(userId, instructions.length > 0);
  return { items, instructions, paymentInstructionsMissing: instructions.length === 0 };
}

export async function getCampaignDetail(campaignId: string, userId: string) {
  const [campaign, user, instructions] = await Promise.all([
    prisma.specialDonationCampaign.findUnique({
      where: { id: campaignId },
      include: {
        payments: {
          where: { participantId: userId },
          include: { declarations: { where: { status: DeclarationStatus.PENDING } } },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    listActiveInstructions(),
  ]);
  if (!campaign) throw ApiError.notFound('Campaign not found.');

  const isLeader = user?.role === UserRole.LEADER || user?.role === UserRole.ADMIN;
  const my = campaign.payments[0];
  if (!isLeader) {
    const visible = campaign.status === CampaignStatus.PUBLISHED || !!my;
    if (!visible || campaign.status === CampaignStatus.DRAFT) throw ApiError.notFound('Campaign not found.');
  }

  const received = (await receivedByCampaign([campaignId])).get(campaignId) ?? 0;
  const pendingDecls = my?.declarations ?? [];
  const pending = {
    count: pendingDecls.length,
    totalMinor: pendingDecls.reduce((s, d) => s + d.amountMinor, 0),
  };
  const base = memberCampaignDto(campaign, my, received, instructions.length > 0, pending);

  const history = my
    ? await prisma.fundingDeclaration.findMany({
        where: { donationPaymentId: my.id }, orderBy: { declaredAt: 'desc' }, take: 50,
      })
    : [];

  let leader: unknown = undefined;
  if (isLeader) {
    const [rows, grouped] = await Promise.all([
      prisma.specialDonationPayment.findMany({
        where: { campaignId, status: { not: FundingStatus.UNPAID } },
        orderBy: { updatedAt: 'desc' }, take: 200,
        include: {
          participant: { select: { phone: true, memberProfile: { select: { fullName: true, profilePhotoUrl: true } } } },
          declarations: { orderBy: { declaredAt: 'desc' }, take: 5 },
        },
      }),
      prisma.specialDonationPayment.groupBy({ by: ['status'], where: { campaignId }, _count: { _all: true } }),
    ]);
    const counts: Record<FundingStatus, number> = { UNPAID: 0, PENDING_VERIFICATION: 0, PAID: 0, REJECTED: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;
    leader = {
      counts,
      received: moneyDto(received),
      payments: rows.map((p) => {
        const pend = p.declarations.filter((d) => d.status === DeclarationStatus.PENDING);
        return {
          id: p.id,
          participantName: p.participant.memberProfile?.fullName ?? p.participant.phone,
          photoUrl: p.participant.memberProfile?.profilePhotoUrl ?? null,
          status: p.status,
          paid: moneyDto(p.paidMinor),
          latestDeclaration: p.declarations[0] ? declarationDto(p.declarations[0]) : null,
          pendingCount: pend.length,
          pendingTotal: pend.length ? moneyDto(pend.reduce((s, d) => s + d.amountMinor, 0)) : null,
        };
      }),
    };
  }

  return {
    ...base,
    instructions,
    paymentInstructionsMissing: instructions.length === 0,
    history: history.map(declarationDto),
    leader,
  };
}

/**
 * "I've Transferred" for a campaign (v2.1).
 * - Multiple pending declarations allowed.
 * - REQUIRED campaigns: amount cap = remaining MINUS pending total.
 * - VOLUNTARY campaigns: any positive amount; each declaration verified separately.
 */
export async function declareCampaignPayment(userId: string, campaignId: string, body: any) {
  const clientId = optString(body?.clientId, 'clientId', 64);
  const reference = optString(body?.reference, 'Reference', 100);
  const paymentMethod = reqPaymentMethod(body?.paymentMethod);
  const amountMinor = reqAmountMinor(body?.amountMinor);

  if (clientId) {
    const prior = await prisma.fundingDeclaration.findUnique({
      where: { participantId_clientId: { participantId: userId, clientId } },
    });
    if (prior) return { declaration: declarationDto(prior), idempotent: true };
  }

  const campaign = await prisma.specialDonationCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== CampaignStatus.PUBLISHED) {
    throw ApiError.conflict('This campaign is not accepting donations.', 'CAMPAIGN_NOT_OPEN');
  }
  if (isPastDeadline(campaign.deadlineDate)) {
    throw ApiError.conflict('The campaign deadline has passed.', 'CAMPAIGN_DEADLINE_PASSED');
  }
  if (!(await hasActiveInstructions())) {
    throw ApiError.badRequest('Payment instructions are not available yet. Please try again later.', 'NO_PAYMENT_INSTRUCTIONS');
  }
  const due = dueOf(campaign);

  try {
    const { decl, paymentId } = await prisma.$transaction(async (tx) => {
      await tx.specialDonationPayment.upsert({
        where: { campaignId_participantId: { campaignId, participantId: userId } },
        create: { campaignId, participantId: userId, amountMinor, status: FundingStatus.UNPAID },
        update: {},
      });
      const payment = await tx.specialDonationPayment.findUniqueOrThrow({
        where: { campaignId_participantId: { campaignId, participantId: userId } },
        include: { declarations: { where: { status: DeclarationStatus.PENDING }, select: { amountMinor: true } } },
      });

      const pendingTotal = payment.declarations.reduce((s, d) => s + d.amountMinor, 0);
      if (due !== null) {
        const remaining = due - payment.paidMinor - pendingTotal;
        if (remaining <= 0) {
          throw ApiError.conflict(
            'You already have declarations covering the full amount. Wait for them to be verified or adjust.',
            'PENDING_COVERS_BALANCE',
          );
        }
        if (amountMinor > remaining) {
          throw ApiError.badRequest(
            `The amount is more than your remaining balance after pending declarations (${formatEtb(remaining)}).`,
            'AMOUNT_EXCEEDS_REMAINING',
          );
        }
      }

      const moved = await tx.specialDonationPayment.updateMany({
        where: { id: payment.id, participantId: userId, version: payment.version },
        data: { status: FundingStatus.PENDING_VERIFICATION, amountMinor, rejectionReason: null, version: { increment: 1 } },
      });
      if (moved.count === 0) throw ApiError.conflict('This payment changed. Please refresh and try again.', 'STALE_RECORD');

      const d = await tx.fundingDeclaration.create({
        data: { donationPaymentId: payment.id, participantId: userId, amountMinor, paymentMethod, reference, clientId },
      });
      await writeAudit(tx, {
        actorId: userId, action: 'DECLARED', recordType: FundingRecordType.DONATION, recordId: payment.id,
        previousStatus: payment.status, newStatus: FundingStatus.PENDING_VERIFICATION,
        details: { declarationId: d.id, amountMinor, paymentMethod, paidBefore: payment.paidMinor, pendingBefore: pendingTotal },
      });
      return { decl: d, paymentId: payment.id };
    });

    const profile = await prisma.memberProfile.findUnique({ where: { userId }, select: { fullName: true } });
    void notifyLeadersVerificationNeeded({
      declarerId: userId, declarerName: profile?.fullName ?? 'A member',
      recordType: REC_TYPE, recordId: paymentId, what: campaign.title,
    });
    return { declaration: declarationDto(decl), idempotent: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw ApiError.conflict('This payment was already declared.', 'ALREADY_DECLARED');
    }
    throw e;
  }
}

// ============================================================
// Leader: verification queue + approve / reject
// ============================================================

export async function leaderListDonations(q: Record<string, unknown>) {
  const { page, pageSize, skip } = pageParams(q);
  const raw = typeof q.status === 'string' ? q.status : undefined;
  const status: FundingStatus | undefined =
    raw === 'ALL' ? undefined : raw && raw in FundingStatus ? (raw as FundingStatus) : FundingStatus.PENDING_VERIFICATION;
  const campaignId = typeof q.campaignId === 'string' && q.campaignId ? q.campaignId : undefined;
  const search = typeof q.q === 'string' ? q.q.trim().slice(0, 80) : '';

  const where: Prisma.SpecialDonationPaymentWhereInput = {
    ...(status ? { status } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...(search ? { participant: { memberProfile: { fullName: { contains: search, mode: 'insensitive' } } } } : {}),
  };

  const [rows, total, grouped] = await Promise.all([
    prisma.specialDonationPayment.findMany({
      where, skip, take: pageSize, orderBy: { updatedAt: 'desc' },
      include: {
        campaign: { select: { id: true, title: true, donationType: true, requestedAmountMinor: true } },
        participant: { select: { id: true, phone: true, memberProfile: { select: { fullName: true, profilePhotoUrl: true } } } },
        declarations: { orderBy: { declaredAt: 'desc' }, take: 5 },
      },
    }),
    prisma.specialDonationPayment.count({ where }),
    prisma.specialDonationPayment.groupBy({
      by: ['status'], where: campaignId ? { campaignId } : {}, _count: { _all: true },
    }),
  ]);

  const counts: Record<FundingStatus, number> = { UNPAID: 0, PENDING_VERIFICATION: 0, PAID: 0, REJECTED: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;

  return {
    page, pageSize, total, counts,
    items: rows.map((p) => {
      const pend = p.declarations.filter((d) => d.status === DeclarationStatus.PENDING);
      return {
        id: p.id,
        type: 'DONATION' as const,
        campaign: { id: p.campaign.id, title: p.campaign.title },
        participant: {
          id: p.participant.id,
          fullName: p.participant.memberProfile?.fullName ?? p.participant.phone,
          photoUrl: p.participant.memberProfile?.profilePhotoUrl ?? null,
        },
        status: p.status,
        progress: progressDto(p.paidMinor, dueOf(p.campaign)),
        latestDeclaration: p.declarations[0] ? declarationDto(p.declarations[0]) : null,
        pendingCount: pend.length,
        pendingTotal: pend.length ? moneyDto(pend.reduce((s, d) => s + d.amountMinor, 0)) : null,
        updatedAt: p.updatedAt,
      };
    }),
  };
}

export async function approveDonation(paymentId: string, leaderId: string, body?: any) {
  const declarationId = optString(body?.declarationId, 'declarationId', 64);
  const rec = await prisma.specialDonationPayment.findUnique({ where: { id: paymentId }, include: { campaign: true } });
  if (!rec) throw ApiError.notFound('Payment not found.');
  if (rec.participantId === leaderId) {
    throw ApiError.forbidden('You cannot verify your own payment. Another leader must do it.', 'SELF_VERIFICATION');
  }
  const now = new Date();

  const out = await prisma.$transaction(async (tx) => {
    const decl = await tx.fundingDeclaration.findFirst({
      where: { donationPaymentId: paymentId, status: DeclarationStatus.PENDING, ...(declarationId ? { id: declarationId } : {}) },
      orderBy: { declaredAt: 'asc' },
    });
    const fresh = await tx.specialDonationPayment.findUnique({ where: { id: paymentId } });
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
      where: { donationPaymentId: paymentId, status: DeclarationStatus.PENDING },
    });
    const settled = settledStatus(rec.campaign, paidMinor);
    const status: FundingStatus = stillPending > 0 ? FundingStatus.PENDING_VERIFICATION : settled;

    const moved = await tx.specialDonationPayment.updateMany({
      where: { id: paymentId, version: fresh.version },
      data: { status, paidMinor, verifiedByUserId: leaderId, verifiedAt: now, rejectionReason: null, version: { increment: 1 } },
    });
    if (moved.count !== 1) {
      throw ApiError.conflict('This payment was already processed by someone else.', 'ALREADY_PROCESSED');
    }
    await writeAudit(tx, {
      actorId: leaderId, action: 'APPROVED', recordType: FundingRecordType.DONATION, recordId: paymentId,
      previousStatus: FundingStatus.PENDING_VERIFICATION, newStatus: status,
      details: { declarationId: decl.id, amountMinor: decl.amountMinor, paymentMethod: decl.paymentMethod, paidMinor, stillPending },
    });
    return { status, paidMinor, amountMinor: decl.amountMinor, stillPending };
  });

  const due = dueOf(rec.campaign);
  const remaining = due === null ? 0 : Math.max(0, due - out.paidMinor);
  void notifyMemberResult({
    memberId: rec.participantId, approved: true, what: rec.campaign.title,
    amountLabel: formatEtb(out.amountMinor), remainingLabel: remaining > 0 ? formatEtb(remaining) : null,
    recordType: REC_TYPE, recordId: paymentId,
  });
  return { ok: true, status: out.status, progress: progressDto(out.paidMinor, due), stillPending: out.stillPending };
}

export async function rejectDonation(paymentId: string, leaderId: string, body: any) {
  const reason = reqString(body?.reason, 'Rejection reason', 3, 500);
  const declarationId = optString(body?.declarationId, 'declarationId', 64);
  const rec = await prisma.specialDonationPayment.findUnique({ where: { id: paymentId }, include: { campaign: true } });
  if (!rec) throw ApiError.notFound('Payment not found.');
  if (rec.participantId === leaderId) {
    throw ApiError.forbidden('You cannot verify your own payment. Another leader must do it.', 'SELF_VERIFICATION');
  }
  const now = new Date();

  const declared = await prisma.$transaction(async (tx) => {
    const decl = await tx.fundingDeclaration.findFirst({
      where: { donationPaymentId: paymentId, status: DeclarationStatus.PENDING, ...(declarationId ? { id: declarationId } : {}) },
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
      where: { donationPaymentId: paymentId, status: DeclarationStatus.PENDING },
    });
    const nextStatus = stillPending > 0 ? FundingStatus.PENDING_VERIFICATION : FundingStatus.REJECTED;
    const moved = await tx.specialDonationPayment.updateMany({
      where: { id: paymentId, status: FundingStatus.PENDING_VERIFICATION },
      data: { status: nextStatus, rejectionReason: stillPending > 0 ? null : reason, version: { increment: 1 } },
    });
    if (moved.count !== 1) {
      throw ApiError.conflict('This payment was already processed by someone else.', 'ALREADY_PROCESSED');
    }
    await writeAudit(tx, {
      actorId: leaderId, action: 'REJECTED', recordType: FundingRecordType.DONATION, recordId: paymentId,
      previousStatus: FundingStatus.PENDING_VERIFICATION, newStatus: nextStatus, reason,
      details: { declarationId: decl.id, amountMinor: decl.amountMinor, stillPending },
    });
    return { decl, stillPending };
  });

  void notifyMemberResult({
    memberId: rec.participantId, approved: false, reason, what: rec.campaign.title,
    amountLabel: formatEtb(declared.decl.amountMinor), recordType: REC_TYPE, recordId: paymentId,
  });
  return { ok: true, status: declared.stillPending > 0 ? FundingStatus.PENDING_VERIFICATION : FundingStatus.REJECTED, stillPending: declared.stillPending };
}

// ============================================================
// Admin: exceptional correction
// ============================================================

export async function adminCorrectDonation(paymentId: string, adminId: string, body: any) {
  const reason = reqString(body?.reason, 'Reason for correction', 5, 500);
  const declarationId = optString(body?.declarationId, 'declarationId', 64);
  const now = new Date();

  const out = await prisma.$transaction(async (tx) => {
    const rec = await tx.specialDonationPayment.findUnique({ where: { id: paymentId }, include: { campaign: true } });
    if (!rec) throw ApiError.notFound('Payment not found.');
    if (rec.status === FundingStatus.PENDING_VERIFICATION) {
      throw ApiError.conflict('Resolve the pending declaration first.', 'PENDING_EXISTS');
    }
    const decl = await tx.fundingDeclaration.findFirst({
      where: { donationPaymentId: paymentId, status: DeclarationStatus.APPROVED, ...(declarationId ? { id: declarationId } : {}) },
      orderBy: { decidedAt: 'desc' },
    });
    if (!decl) throw ApiError.conflict('There is no approved payment to correct.', 'NOT_PAID');

    const voided = await tx.fundingDeclaration.updateMany({
      where: { id: decl.id, status: DeclarationStatus.APPROVED },
      data: { status: DeclarationStatus.VOID, decidedAt: now, rejectionReason: `Corrected: ${reason}` },
    });
    if (voided.count !== 1) throw ApiError.conflict('Already corrected.', 'ALREADY_PROCESSED');

    const paidMinor = Math.max(0, rec.paidMinor - decl.amountMinor);
    const status = settledStatus(rec.campaign, paidMinor);
    const moved = await tx.specialDonationPayment.updateMany({
      where: { id: paymentId, version: rec.version, status: { not: FundingStatus.PENDING_VERIFICATION } },
      data: { status, paidMinor, verifiedByUserId: null, verifiedAt: null, version: { increment: 1 } },
    });
    if (moved.count !== 1) throw ApiError.conflict('The payment changed. Please retry.', 'STALE_RECORD');

    await writeAudit(tx, {
      actorId: adminId, action: 'CORRECTED', recordType: FundingRecordType.DONATION, recordId: paymentId,
      previousStatus: rec.status, newStatus: status, reason,
      details: { declarationId: decl.id, amountMinor: decl.amountMinor, paidMinor },
    });
    return { status, paidMinor, due: dueOf(rec.campaign) };
  });
  return { ok: true, status: out.status, progress: progressDto(out.paidMinor, out.due) };
}