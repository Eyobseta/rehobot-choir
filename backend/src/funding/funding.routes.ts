import { Router } from 'express';
import { authenticate, authorize, touchLastActive } from '../auth/middleware';
import { ApiError } from '../utils/ApiError';
import { idParam } from './funding.validation';
import {
  getMyFunding, declareAnnualPayment, leaderListAnnual, leaderGetAnnual, approveAnnual, rejectAnnual,
  leaderGetAnnualConfig, leaderPreviewDeadline, leaderUpsertAnnualConfig,
} from './annual.service';
import { approveDonation, rejectDonation } from './campaign.service';
import {
  listActiveInstructions, adminListInstructions, adminCreateInstruction, adminUpdateInstruction,
} from './funding.config.service';

const router = Router();
router.use(authenticate, touchLastActive);

// ---------- Member ----------
// { annual, notEligible, instructions, paymentInstructionsMissing, campaigns[], pastYears[] }
router.get('/me', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await getMyFunding(req.auth.userId));
  } catch (e) { next(e); }
});

// Official Bank/Telebirr details for the "Payment Instructions" step (annual + campaigns).
router.get('/payment-instructions', async (_req, res, next) => {
  try { res.json({ items: await listActiveInstructions() }); } catch (e) { next(e); }
});

// body: { paymentMethod: 'BANK'|'TELEBIRR', amountMinor, reference?, clientId? }
router.post('/annual/:recordId/declarations', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const out = await declareAnnualPayment(req.auth.userId, idParam(req.params.recordId), req.body ?? {});
    res.status(out.idempotent ? 200 : 201).json(out);
  } catch (e) { next(e); }
});

// ---------- Leader: annual verification ----------
router.get('/leader/records', authorize('LEADER'), async (req, res, next) => {
  try { res.json(await leaderListAnnual(req.query as Record<string, unknown>)); } catch (e) { next(e); }
});

router.get('/leader/records/:id', authorize('LEADER'), async (req, res, next) => {
  try { res.json({ item: await leaderGetAnnual(idParam(req.params.id)) }); } catch (e) { next(e); }
});

router.post('/records/:id/approve', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await approveAnnual(idParam(req.params.id), req.auth.userId));
  } catch (e) { next(e); }
});

router.post('/records/:id/reject', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await rejectAnnual(idParam(req.params.id), req.auth.userId, req.body ?? {}));
  } catch (e) { next(e); }
});

// ---------- Leader: donation verification ----------
router.post('/donations/:id/approve', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await approveDonation(idParam(req.params.id), req.auth.userId));
  } catch (e) { next(e); }
});

router.post('/donations/:id/reject', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await rejectDonation(idParam(req.params.id), req.auth.userId, req.body ?? {}));
  } catch (e) { next(e); }
});

// ---------- Leader: annual configuration (v2) ----------
router.get('/leader/annual-config', authorize('LEADER'), async (_req, res, next) => {
  try { res.json({ item: await leaderGetAnnualConfig() }); } catch (e) { next(e); }
});

// Backend-authoritative deadline preview, shown BEFORE saving. body: { expiry: {year,month,day} }
router.post('/leader/annual-config/preview', authorize('LEADER'), (req, res, next) => {
  try { res.json(leaderPreviewDeadline(req.body)); } catch (e) { next(e); }
});

router.post('/leader/annual-config', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json({ item: await leaderUpsertAnnualConfig(req.auth.userId, req.body ?? {}) });
  } catch (e) { next(e); }
});

// ---------- Leader: official payment instructions (v2: set once, reused everywhere) ----------
router.get('/leader/payment-instructions', authorize('LEADER'), async (_req, res, next) => {
  try { res.json({ items: await adminListInstructions() }); } catch (e) { next(e); }
});

router.post('/leader/payment-instructions', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.status(201).json({ item: await adminCreateInstruction(req.auth.userId, req.body ?? {}) });
  } catch (e) { next(e); }
});

router.patch('/leader/payment-instructions/:id', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json({ item: await adminUpdateInstruction(req.auth.userId, idParam(req.params.id), req.body ?? {}) });
  } catch (e) { next(e); }
});

export default router;