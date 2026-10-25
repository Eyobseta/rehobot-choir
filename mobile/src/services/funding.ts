import { apiGet, apiPost, apiPatch } from './api'; // assumes apiPatch has the same signature as apiPost
import { cachedFetch, cacheInvalidatePrefix } from './cache';
import { CACHE_KEYS, CACHE_PREFIXES } from './cacheKeys';

export { apiGet };

/**
 * Types here mirror the backend DTOs 1:1 (funding.dto.ts, annual.service.ts, campaign.service.ts).
 * The server is authoritative for progress, canDeclare and deadlinePassed: the app never recomputes them.
 */

// ---------- Primitives ----------
export type FundingStatus = 'UNPAID' | 'PENDING_VERIFICATION' | 'PAID' | 'REJECTED';
export type PaymentMethod = 'BANK' | 'TELEBIRR';
export type Money = { minor: number; label: string };
export type EthDate = { year: number; month: number; day: number };
export type DateDto = { iso: string; eth: EthDate; labelEn: string; labelAm: string };

/** progressDto(): `paid` is VERIFIED money only. target/remaining/percent are null for open-amount. */
export type Progress = {
  paid: Money;
  target: Money | null;
  remaining: Money | null;
  percent: number | null;
};

export type Declaration = {
  id: string;
  amount: Money;
  reference: string | null;
  paymentMethod: PaymentMethod | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOID';
  declaredAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
};

export type PaymentInstruction = {
  id: string;
  method: PaymentMethod;
  providerName: string;
  accountHolderName: string;
  accountIdentifier: string;
  note: string | null;
  active: boolean;
};

// ---------- Member: /funding/me ----------
export type AnnualConfigPublic = {
  id: string; contributionYear: number; active: boolean;
  referenceEnabled: boolean; receiptUploadsEnabled: boolean;
};

export type AnnualRecord = {
  id: string;
  contributionYear: number;
  amountDue: Money;
  progress: Progress;
  status: FundingStatus;
  pendingAmount: Money | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  deadline: DateDto;
  deadlinePassed: boolean;
  canDeclare: boolean;
    /** v2.1: sum of declarations currently pending. */
  pendingCount: number;
};

export type CampaignStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
export type DonationType = 'VOLUNTARY' | 'REQUIRED';

/** One campaign as a member sees it (list + detail base). */
export type MemberCampaign = {
  id: string;
  title: string;
  description: string;
  donationType: DonationType;
  status: CampaignStatus;
  requestedAmount: Money | null;
  targetAmount: Money | null;
  deadline: DateDto;
  deadlinePassed: boolean;
  imageUrl: string | null;
  /** Whole campaign vs overall target (verified only). */
  campaignProgress: Progress;
  my: {
    status: FundingStatus;
    /** target = what I owe (REQUIRED) or null (VOLUNTARY). */
    progress: Progress;
    pendingAmount: Money | null;
    rejectionReason: string | null;
    canDeclare: boolean;
        pendingCount: number;
  };
};

export type MyFunding = {
  annual: null | {
    config: AnnualConfigPublic;
    record: AnnualRecord;
    history: Declaration[];
  };
  notEligible: boolean;
  instructions: PaymentInstruction[];
  paymentInstructionsMissing: boolean;
  campaigns: MemberCampaign[];
  pastYears: {
    id: string; contributionYear: number; amountDue: Money; progress: Progress;
    status: FundingStatus; verifiedAt: string | null;
  }[];
};

export type LeaderCampaignPayment = {
  id: string; // SpecialDonationPayment id -> approve/reject
  participantName: string;
  photoUrl: string | null;
  status: FundingStatus;
  paid: Money;
  latestDeclaration: Declaration | null;
  pendingCount: number;
};

export type CampaignDetail = MemberCampaign & {
  instructions: PaymentInstruction[];
  paymentInstructionsMissing: boolean;
  history: Declaration[];
  /** Present only for leaders/admins. */
  leader?: {
    counts: Record<FundingStatus, number>;
    received: Money;
    payments: LeaderCampaignPayment[];
  };
};

// ---------- Leader ----------
export type LeaderRow = {
  id: string;
  type: 'ANNUAL';
  contributionYear: number;
  status: FundingStatus;
  amountDue: Money;
  progress: Progress;
  deadline: DateDto;
  participant: { id: string; fullName: string; photoUrl: string | null; role: string };
  verifiedAt: string | null;
  rejectionReason: string | null;
  latestDeclaration: Declaration | null;
    pendingCount: number;
  pendingTotal: Money | null;
};

export type LeaderList = {
  year: number | null; page: number; pageSize: number; total: number;
  counts: Record<FundingStatus, number>;
  totals: { received: Money; outstanding: Money; expected: Money; eligibleParticipants: number } | null;
  items: LeaderRow[];
};

export type LeaderDonationRow = {
  id: string; // SpecialDonationPayment id
  type: 'DONATION';
  campaign: { id: string; title: string };
  participant: { id: string; fullName: string; photoUrl: string | null };
  status: FundingStatus;
  progress: Progress;
  latestDeclaration: Declaration | null;
  updatedAt: string;
    pendingCount: number;
  pendingTotal: Money | null;
};

export type LeaderDonationList = {
  page: number; pageSize: number; total: number;
  counts: Record<FundingStatus, number>;
  items: LeaderDonationRow[];
};

export type LeaderCampaign = {
  id: string; title: string; status: CampaignStatus; donationType: DonationType;
  deadline: DateDto; requestedAmount: Money | null; targetAmount: Money | null;
  progress: Progress; pendingCount: number;
};

export type AnnualConfig = {
  id: string; contributionYear: number; amount: Money;
  expiry: DateDto; deadline: DateDto; active: boolean;
};

export type DeadlinePreview = {
  expiry: { eth: EthDate; labelEn: string; labelAm: string };
  deadline: { eth: EthDate; labelEn: string; labelAm: string };
};

export type LedgerFilter = FundingStatus | 'ALL';

// ---------- Helpers ----------
/** Stable per attempt: a retried tap with the same inputs reuses it, so the server de-duplicates. */
export const makeClientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---------- Member ----------
export type DeclareInput = { clientId: string; amountMinor: number; paymentMethod: PaymentMethod; reference?: string };

export const getMyFunding = async () => {
  const cached = await cachedFetch<MyFunding>(
    CACHE_KEYS.myFunding,
    async () => apiGet<MyFunding>('/funding/me'),
    () => {},
  );
  if (cached) return cached;
  return apiGet<MyFunding>('/funding/me');
};

export const getPaymentInstructions = async () => {
  const cached = await cachedFetch<{ items: PaymentInstruction[] }>(
    CACHE_KEYS.paymentInstructions,
    async () => apiGet<{ items: PaymentInstruction[] }>('/funding/payment-instructions'),
    () => {},
  );
  if (cached) return cached;
  return apiGet<{ items: PaymentInstruction[] }>('/funding/payment-instructions');
};

export const declareAnnualPayment = async (recordId: string, body: DeclareInput) => {
  const res = await apiPost<{ declaration: Declaration; idempotent: boolean }>(
    `/funding/annual/${recordId}/declarations`,
    body,
  );
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

export const getCampaignDetail = async (id: string) => {
  const key = CACHE_KEYS.campaignDetail(id);
  const cached = await cachedFetch<{ item: CampaignDetail }>(
    key,
    async () => apiGet<{ item: CampaignDetail }>(`/funding/campaigns/${id}`),
    () => {},
  );
  if (cached) return cached;
  return apiGet<{ item: CampaignDetail }>(`/funding/campaigns/${id}`);
};

export const declareCampaignPayment = async (campaignId: string, body: DeclareInput) => {
  const res = await apiPost<{ declaration: Declaration; idempotent: boolean }>(
    `/funding/campaigns/${campaignId}/declarations`,
    body,
  );
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

// ---------- Leader: verification ----------
export function leaderListRecords(p: { status?: LedgerFilter; q?: string; page?: number; pageSize?: number }) {
  const qs = new URLSearchParams();
  if (p.status) qs.set('status', p.status);
  if (p.q) qs.set('q', p.q);
  qs.set('page', String(p.page ?? 1));
  qs.set('pageSize', String(p.pageSize ?? 20));
  return apiGet<LeaderList>(`/funding/leader/records?${qs.toString()}`);
}

export function leaderListDonations(p: { status?: LedgerFilter; campaignId?: string; q?: string; page?: number; pageSize?: number }) {
  const qs = new URLSearchParams();
  if (p.status) qs.set('status', p.status);
  if (p.campaignId) qs.set('campaignId', p.campaignId);
  if (p.q) qs.set('q', p.q);
  qs.set('page', String(p.page ?? 1));
  qs.set('pageSize', String(p.pageSize ?? 20));
  return apiGet<LeaderDonationList>(`/funding/leader/donations?${qs.toString()}`);
}

export const approveRecord = async (id: string, declarationId?: string) => {
  const res = await apiPost<{ ok: true; stillPending?: number }>(
    `/funding/records/${id}/approve`,
    declarationId ? { declarationId } : {},
  );
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

export const rejectRecord = async (id: string, reason: string, declarationId?: string) => {
  const res = await apiPost<{ ok: true; stillPending?: number }>(
    `/funding/records/${id}/reject`,
    declarationId ? { reason, declarationId } : { reason },
  );
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

export const approveDonation = async (id: string, declarationId?: string) => {
  const res = await apiPost<{ ok: true; stillPending?: number }>(
    `/funding/donations/${id}/approve`,
    declarationId ? { declarationId } : {},
  );
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

export const rejectDonation = async (id: string, reason: string, declarationId?: string) => {
  const res = await apiPost<{ ok: true; stillPending?: number }>(
    `/funding/donations/${id}/reject`,
    declarationId ? { reason, declarationId } : { reason },
  );
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

// ---------- Leader: campaigns ----------
export type CampaignInput = {
  title: string; description: string; donationType: DonationType;
  requestedAmountMinor?: number | null; targetAmountMinor?: number | null; deadline: EthDate;
};
/** PATCH body: any subset. A PUBLISHED campaign also needs `reason` and may not change type/amount. */
export type CampaignPatch = Partial<CampaignInput> & { reason?: string };

export const leaderListCampaigns = async () => {
  const cached = await cachedFetch<{ items: LeaderCampaign[] }>(
    CACHE_KEYS.leaderCampaigns,
    async () => apiGet<{ items: LeaderCampaign[] }>('/funding/leader/campaigns'),
    () => {},
  );
  if (cached) return cached;
  return apiGet<{ items: LeaderCampaign[] }>('/funding/leader/campaigns');
};

export const leaderCreateCampaign = async (body: CampaignInput) => {
  const res = await apiPost<{ id: string }>('/funding/leader/campaigns', body);
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

export const leaderUpdateCampaign = async (id: string, body: CampaignPatch) => {
  const res = await apiPatch<{ ok: true }>(`/funding/leader/campaigns/${id}`, body);
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

export const leaderPublishCampaign = async (id: string) => {
  const res = await apiPost<{ ok: true }>(`/funding/leader/campaigns/${id}/publish`, {});
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

export const leaderCloseCampaign = async (id: string) => {
  const res = await apiPost<{ ok: true }>(`/funding/leader/campaigns/${id}/close`, {});
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

export const leaderCancelCampaign = async (id: string, reason: string) => {
  const res = await apiPost<{ ok: true }>(`/funding/leader/campaigns/${id}/cancel`, { reason });
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

// ---------- Leader: annual configuration ----------
export const leaderGetAnnualConfig = () => apiGet<{ item: AnnualConfig | null }>('/funding/leader/annual-config');

export const leaderPreviewDeadline = (expiry: EthDate) =>
  apiPost<DeadlinePreview>('/funding/leader/annual-config/preview', { expiry });

export const leaderUpsertAnnualConfig = async (body: {
  contributionYear: number; amountMinor: number; expiry: EthDate; confirmedDeadline: EthDate;
  active: boolean; reason?: string;
}) => {
  const res = await apiPost<{ item: AnnualConfig }>('/funding/leader/annual-config', body);
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

// ---------- Leader: payment instructions (set once, reused everywhere) ----------
export type InstructionInput = {
  method: PaymentMethod; providerName: string; accountHolderName: string;
  accountIdentifier: string; note?: string; active: boolean;
};

export const leaderListInstructions = () => apiGet<{ items: PaymentInstruction[] }>('/funding/leader/payment-instructions');

export const leaderCreateInstruction = async (b: InstructionInput) => {
  const res = await apiPost<{ item: PaymentInstruction }>('/funding/leader/payment-instructions', { ...b, confirm: true });
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};

export const leaderUpdateInstruction = async (id: string, b: Partial<InstructionInput> & { reason: string }) => {
  const res = await apiPatch<{ item: PaymentInstruction }>(`/funding/leader/payment-instructions/${id}`, { ...b, confirm: true });
  await cacheInvalidatePrefix(CACHE_PREFIXES.funding);
  return res;
};