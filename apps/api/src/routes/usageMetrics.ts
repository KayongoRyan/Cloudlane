import { Router, Response } from 'express';
import { AuthRequest, authenticateRequest } from '../middleware/auth';
import { createUsageMetric, findDeploymentById, listUsageMetrics, writeAuditLog } from '../database';

const router = Router();
router.use(authenticateRequest);

const METRIC_TYPES = new Set([
  'cpu_seconds',
  'memory_mb_seconds',
  'requests',
  'idle_seconds',
  'compute_seconds',
]);

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.tenantId) return res.status(401).json({ error: 'Unauthorized' });

  const deploymentId = typeof req.query.deploymentId === 'string' ? req.query.deploymentId : undefined;
  const limit = parseInt(String(req.query.limit || '100'), 10);
  const metrics = await listUsageMetrics(req.tenantId, deploymentId, Number.isFinite(limit) ? limit : 100);
  return res.json({ usageMetrics: metrics });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.tenantId || !req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { deploymentId, metricType, value, windowStart, windowEnd } = req.body as {
    deploymentId?: string;
    metricType?: string;
    value?: number;
    windowStart?: string;
    windowEnd?: string;
  };

  if (!deploymentId || !metricType || value == null || !windowStart || !windowEnd) {
    return res.status(400).json({
      error: 'deploymentId, metricType, value, windowStart, and windowEnd are required',
    });
  }

  if (!METRIC_TYPES.has(metricType)) {
    return res.status(400).json({
      error: `metricType must be one of: ${[...METRIC_TYPES].join(', ')}`,
    });
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return res.status(400).json({ error: 'value must be a non-negative number' });
  }

  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return res.status(400).json({ error: 'windowStart/windowEnd must be valid ISO dates with end > start' });
  }

  const deployment = await findDeploymentById(deploymentId, req.tenantId);
  if (!deployment) return res.status(404).json({ error: 'Deployment not found' });

  const metric = await createUsageMetric({
    tenantId: req.tenantId,
    deploymentId,
    metricType,
    value: numeric,
    windowStart: start,
    windowEnd: end,
  });

  await writeAuditLog({
    tenantId: req.tenantId,
    userId: req.userId,
    action: 'usage_metric.create',
    resourceType: 'usage_metric',
    resourceId: metric.id,
    changes: { deploymentId, metricType, value: numeric },
  });

  return res.status(201).json({ usageMetric: metric });
});

export default router;
