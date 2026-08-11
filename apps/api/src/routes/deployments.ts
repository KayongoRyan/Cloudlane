import { Router, Response } from 'express';
import { AuthRequest, authenticateJWT } from '../middleware/auth';
import { createDeployment, listDeployments, updateDeploymentStatus } from '../database';
import kubernetesService from '../services/kubernetes';

const router = Router();

router.use(authenticateJWT);

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
    const { name, image, port } = req.body as {
        name?: string;
        image?: string;
        port?: number;
    };

    if (!tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name || !image || !port) {
        return res.status(400).json({ error: 'Name, image, and port are required' });
    }

    const sanitizedName = name.replace(/[^a-z0-9-]/gi, '').toLowerCase();
    const subdomain = `${sanitizedName}-${Math.random().toString(36).slice(2, 8)}`;
    const deploymentNamespace = `tenant-${tenantId}`;
    const deploymentName = name.replace(/\s+/g, '-').toLowerCase();

    const deployment = await createDeployment({
        tenantId,
        name: deploymentName,
        image,
        port,
        subdomain,
        status: 'deploying',
        scaleToZero: true,
        minReplicas: 1,
        maxReplicas: 3,
        currentReplicas: 1,
        kubernetesNamespace: deploymentNamespace,
        environment: {},
    });

    try {
        await kubernetesService.createNamespace(deploymentNamespace, tenantId);
        await kubernetesService.createDeployment(
            deploymentNamespace,
            deploymentName,
            image,
            port,
            deployment.minReplicas,
            deployment.maxReplicas,
            deployment.environment as Record<string, string>
        );
        await kubernetesService.createService(deploymentNamespace, deploymentName, port, port);
        await kubernetesService.createIngress(
            deploymentNamespace,
            `${deploymentName}-ingress`,
            deploymentName,
            subdomain,
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
