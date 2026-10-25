import { Router } from 'express';
import { authenticate, authorize, touchLastActive } from '../auth/middleware';
import { ApiError } from '../utils/ApiError';
import { idParam } from './funding.validation';
import {
  adminGetConfigs, previewDeadline, adminUpsertConfig,
  adminListInstructions, adminCreateInstruction, adminUpdateInstruction,
} from './funding.config.service';
import { adminCorrectAnnual, adminListAudit } from './annual.service';
import { adminCorrectDonation } from './campaign.service';

const router = Router();
router.use(authenticate, touchLastActive, authorize('ADMIN'));

router.get('/configuration', async (_req, res, next) => {
  try { res.json({ items: await adminGetConfigs() }); } catch (e) { next(e); }
});

// Backend-authoritative deadline preview, shown to the admin BEFORE saving.
router.post('/configuration/preview', (req, res, next) => {
  try { res.json(previewDeadline(req.body)); } catch (e) { next(e); }
});

router.patch('/configuration', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json({ item: await adminUpsertConfig(req.auth.userId, req.body ?? {}) });
  } catch (e) { next(e); }
});

router.get('/payment-instructions', async (_req, res, next) => {
  try { res.json({ items: await adminListInstructions() }); } catch (e) { next(e); }
});

router.post('/payment-instructions', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.status(201).json({ item: await adminCreateInstruction(req.auth.userId, req.body ?? {}) });
  } catch (e) { next(e); }
});

router.patch('/payment-instructions/:id', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json({ item: await adminUpdateInstruction(req.auth.userId, idParam(req.params.id), req.body ?? {}) });
  } catch (e) { next(e); }
});

router.post('/records/:id/correct', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await adminCorrectAnnual(idParam(req.params.id), req.auth.userId, req.body ?? {}));
  } catch (e) { next(e); }
});

router.post('/donations/:id/correct', async (req, res, next) => {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    res.json(await adminCorrectDonation(idParam(req.params.id), req.auth.userId, req.body ?? {}));
  } catch (e) { next(e); }
});

router.get('/audit', async (req, res, next) => {
  try { res.json(await adminListAudit(req.query as Record<string, unknown>)); } catch (e) { next(e); }
});

export default router;