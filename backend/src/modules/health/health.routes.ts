import { Router, Request, Response } from 'express';
import { pingDatabase } from '../../db/prisma';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbOk = await pingDatabase();

  res.json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    services: {
      api: 'ok',
      database: dbOk ? 'ok' : 'down',
    },
  });
});

export default router;