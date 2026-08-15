import { Router, Response } from 'express';
import { AuthRequest, authenticateRequest } from '../middleware/auth';
import {
  createDeployment,
  listDeployments,
  updateDeploymentStatus,
  writeAuditLog,
} from '../database';
import kubernetesService from '../services/kubernetes';
import config from '../config';

const router = Router();

router.use(authenticateRequest);

function clientIp(req: AuthRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.ip || null;
}

router.get('/', async (req: AuthRequest, res: Response) => {
  const tenantId = req.tenantId;

  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const deployments = await listDeployments(tenantId);
  return res.json({ deployments });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const tenantId = req.tenantId;
  const { name, image, port, cpu, memory, minInstances, maxInstances } = req.body as {
    name?: string;
    image?: string;
    port?: number;
    cpu?: number;
    memory?: number;
    minInstances?: number;
    maxInstances?: number;
  };

  if (!tenantId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!name || !image || !port) {
    return res.status(400).json({ error: 'Name, image, and port are required' });
  }

  const slug = name.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'app';
  const host = `${slug}-${Math.random().toString(36).slice(2, 8)}`;
  const publicUrl = `https://${host}.${config.baseDomain}`;
  const k8sNamespace = `tenant-${tenantId}`.slice(0, 63);
  const deploymentName = name.replace(/\s+/g, '-').toLowerCase();
  const min = minInstances ?? 0;
  const max = maxInstances ?? 3;

  const deployment = await createDeployment({
    tenantId,
    name: deploymentName,
    slug,
    image,
    cpu: cpu ?? 0.5,
    memory: memory ?? 256,
    minInstances: min,
    maxInstances: max,
    status: 'deploying',
    publicUrl,
    k8sNamespace,
    port,
  });

  await writeAuditLog({
    tenantId,
    userId: req.userId,
    action: 'deployment.create',
    resourceType: 'deployment',
    resourceId: deployment.id,
    changes: { name: deploymentName, image, publicUrl },
    ipAddress: clientIp(req),
  });

  try {
    await kubernetesService.createNamespace(k8sNamespace, tenantId);
    await kubernetesService.createDeployment(
      k8sNamespace,
      deploymentName,
      image,
      port,
      deployment.minInstances,
      deployment.maxInstances,
      {}
    );
    await kubernetesService.createService(k8sNamespace, deploymentName, port, port);
    await kubernetesService.createIngress(
      k8sNamespace,
      `${deploymentName}-ingress`,
      deploymentName,
      host,
      port
    );

    const runningDeployment = await updateDeploymentStatus(deployment.id, 'running');

    return res.status(201).json({ deployment: runningDeployment });
  } catch (error: any) {
    await updateDeploymentStatus(deployment.id, 'failed');
    return res.status(500).json({ error: error.message || 'Failed to deploy' });
  }
});

export default router;
