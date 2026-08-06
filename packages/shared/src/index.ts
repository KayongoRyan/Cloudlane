// Shared types for Cloudlane

export interface Tenant {
  _id: string;
  name: string;
  slug: string;
  ownerId: string;
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  _id: string;
  tenantId: string;
  name: string;
  image: string;
  port: number;
  subdomain: string;
  status: 'pending' | 'deploying' | 'running' | 'stopped' | 'failed';
  scaleToZero: boolean;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  tenantId: string;
  email: string;
  role: 'admin' | 'developer' | 'viewer';
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  _id: string;
  tenantId: string;
  name: string;
  prefix: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface UsageRecord {
  _id: string;
  tenantId: string;
  deploymentId: string;
  timestamp: string;
  durationSeconds: number;
  requestCount: number;
  memoryMbSeconds: number;
  cpuMillisSeconds: number;
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

export interface AuditLog {
  _id: string;
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DeployRequest {
  name?: string;
  image: string;
  port?: number;
  scaleToZero?: boolean;
  environment?: Record<string, string>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  apiKey: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}
