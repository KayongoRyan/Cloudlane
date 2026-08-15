import { Router, Response } from 'express';
import { AuthRequest, authenticateRequest } from '../middleware/auth';
import { listAuditLogs } from '../database';

const router = Router();
router.use(authenticateRequest);

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.tenantId) return res.status(401).json({ error: 'Unauthorized' });

  const limit = parseInt(String(req.query.limit || '50'), 10);
  const logs = await listAuditLogs(req.tenantId, Number.isFinite(limit) ? limit : 50);
  return res.json({ auditLogs: logs });
});

export default router;
