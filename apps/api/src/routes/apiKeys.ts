import { Router, Response } from 'express';
import { AuthRequest, authenticateRequest } from '../middleware/auth';
import { createApiKey, deleteApiKey, listApiKeys, writeAuditLog } from '../database';
import { generateApiKey, hashApiKey } from '../services/utils';

const router = Router();
router.use(authenticateRequest);

function clientIp(req: AuthRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.ip || null;
}

router.get('/', async (req: AuthRequest, res: Response) => {
  if (!req.tenantId) return res.status(401).json({ error: 'Unauthorized' });
  const keys = await listApiKeys(req.tenantId);
  return res.json({ apiKeys: keys });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  if (!req.tenantId || !req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { name, scopes, expiresAt } = req.body as {
    name?: string;
    scopes?: string[];
    expiresAt?: string;
  };

  const keyName = (name || 'CLI key').trim();
  if (!keyName) return res.status(400).json({ error: 'Name is required' });

  const parsedScopes = Array.isArray(scopes) && scopes.length
    ? scopes.map(String)
    : ['deploy', 'read'];

  let expiry: Date | null = null;
  if (expiresAt) {
    expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime())) {
      return res.status(400).json({ error: 'expiresAt must be an ISO date' });
    }
  }

  const { key, prefix } = generateApiKey();
  const record = await createApiKey({
    tenantId: req.tenantId,
    userId: req.userId,
    name: keyName,
    keyHash: hashApiKey(key),
    prefix,
    scopes: parsedScopes,
    expiresAt: expiry,
  });

  await writeAuditLog({
    tenantId: req.tenantId,
    userId: req.userId,
    action: 'api_key.create',
    resourceType: 'api_key',
    resourceId: record.id,
    changes: { name: keyName, scopes: parsedScopes },
    ipAddress: clientIp(req),
  });

  return res.status(201).json({ apiKey: record, key });
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (!req.tenantId || !req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const ok = await deleteApiKey(req.params.id, req.tenantId);
  if (!ok) return res.status(404).json({ error: 'API key not found' });

  await writeAuditLog({
    tenantId: req.tenantId,
    userId: req.userId,
    action: 'api_key.delete',
    resourceType: 'api_key',
    resourceId: req.params.id,
    ipAddress: clientIp(req),
  });

  return res.status(204).send();
});

export default router;
