// Shared types for Cloudlane — matches the Mongo ERD (ObjectId hex strings on the wire)

export interface TenantLimits {
  maxDeployments: number;
  maxCpu: number;
  maxMemoryMb: number;
  maxInstances: number;
}

export interface Tenant {
  _id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'deleted';
  tier: 'free' | 'pro' | 'enterprise';
  limits: TenantLimits;
  irembopayCustomerId: string | null;
  createdAt: string;
}

export interface User {
  _id: string;
  tenantId: string;
  email: string;
  role: 'admin' | 'developer' | 'viewer';
  status: 'active' | 'invited' | 'disabled';
  createdAt: string;
}

export interface Deployment {
  _id: string;
  tenantId: string;
  name: string;
  slug: string;
  image: string;
  cpu: number;
  memory: number;
  minInstances: number;
  maxInstances: number;
  status: 'pending' | 'deploying' | 'running' | 'stopped' | 'failed';
  publicUrl: string;
  k8sNamespace: string;
  port: number;
  deletedAt: string | null;
  createdAt: string;
}

export interface ApiKey {
  _id: string;
  tenantId: string;
  userId: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
}

export interface AuditLog {
  _id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  changes: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface UsageMetric {
  _id: string;
  tenantId: string;
  deploymentId: string;
  metricType: string;
  value: number;
  windowStart: string;
  windowEnd: string;
}

export interface BillingRecord {
  _id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  iremboPayTransactionId?: string;
  breakdown: {
    computeCost: number;
    requestCost: number;
    memoryCost: number;
  };
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DeployRequest {
  name?: string;
  image: string;
  port?: number;
  cpu?: number;
  memory?: number;
  minInstances?: number;
  maxInstances?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}
