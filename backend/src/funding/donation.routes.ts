import { Router } from 'express';
import { authenticate, authorize, touchLastActive } from '../auth/middleware';
import { ApiError } from '../utils/ApiError';
import { idParam } from './funding.validation';
import {
  getActiveCampaigns, getCampaignDetail, declareCampaignPayment,
  leaderCreateCampaign, leaderUpdateCampaign, leaderListCampaigns,
  leaderPublishCampaign, leaderCloseCampaign, leaderCancelCampaign,
  leaderListDonations,
} from './campaign.service';

const router = Router();
router.use(authenticate, touchLastActive);

// ---------- Member ----------
// Returns { items, instructions, paymentInstructionsMissing }
router.get('/campaigns', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await getActiveCampaigns(req.auth.userId));
  } catch (e) { next(e); }
});

router.get('/campaigns/:id', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json({ item: await getCampaignDetail(idParam(req.params.id), req.auth.userId) });
  } catch (e) { next(e); }
});

router.post('/campaigns/:id/declarations', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const out = await declareCampaignPayment(req.auth.userId, idParam(req.params.id), req.body ?? {});
    res.status(out.idempotent ? 200 : 201).json(out);
  } catch (e) { next(e); }
});

// ---------- Leader: verification queue ----------
// ?status=PENDING_VERIFICATION (default) | PAID | REJECTED | UNPAID | ALL  &campaignId=  &q=  &page=
router.get('/leader/donations', authorize('LEADER'), async (req, res, next) => {
  try { res.json(await leaderListDonations(req.query as Record<string, unknown>)); } catch (e) { next(e); }
});

// ---------- Leader: campaign management ----------
router.get('/leader/campaigns', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json({ items: await leaderListCampaigns(req.auth.userId) });
  } catch (e) { next(e); }
});

router.post('/leader/campaigns', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.status(201).json(await leaderCreateCampaign(req.auth.userId, req.body ?? {}));
  } catch (e) { next(e); }
});

router.patch('/leader/campaigns/:id', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await leaderUpdateCampaign(idParam(req.params.id), req.auth.userId, req.body ?? {}));
  } catch (e) { next(e); }
});

router.post('/leader/campaigns/:id/publish', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await leaderPublishCampaign(idParam(req.params.id), req.auth.userId));
  } catch (e) { next(e); }
});

router.post('/leader/campaigns/:id/close', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await leaderCloseCampaign(idParam(req.params.id), req.auth.userId));
  } catch (e) { next(e); }
});

router.post('/leader/campaigns/:id/cancel', authorize('LEADER'), async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await leaderCancelCampaign(idParam(req.params.id), req.auth.userId, req.body ?? {}));
  } catch (e) { next(e); }
});

export default router;