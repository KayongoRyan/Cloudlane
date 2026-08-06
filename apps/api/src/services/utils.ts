import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export function generateSubdomain(): string {
  const randomPart = crypto.randomBytes(4).toString('hex');
  return `app-${randomPart}`;
}

export function generateNamespaceName(tenantSlug: string, deploymentName: string): string {
  const combined = `${tenantSlug}-${deploymentName}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return combined.substring(0, 63); // Kubernetes namespace name limit
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export function generateApiKey(): { key: string; prefix: string } {
  const key = `cl_${uuidv4().replace(/-/g, '')}`;
  const prefix = key.substring(0, 8);
  return { key, prefix };
}

export function generateId(): string {
  return uuidv4();
}
