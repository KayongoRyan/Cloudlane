import mongoose from 'mongoose';

export interface ITenant {
  name: string;
  slug: string;
  ownerId: string;
  tier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new mongoose.Schema<ITenant>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true, index: true },
    tier: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'deleted'],
      default: 'active',
    },
  },
  { timestamps: true }
);

tenantSchema.index({ slug: 1 });
tenantSchema.index({ ownerId: 1 });

export const Tenant = mongoose.model<ITenant>('Tenant', tenantSchema);

// User model
export interface IUser {
  tenantId: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'developer' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    tenantId: { type: String, required: true, index: true },
    email: { type: String, required: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'developer', 'viewer'],
      default: 'developer',
    },
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 });

export const User = mongoose.model<IUser>('User', userSchema);

// API Key model for CLI authentication
export interface IApiKey {
  tenantId: string;
  name: string;
  keyHash: string;
  prefix: string; // First 8 chars for identification
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

const apiKeySchema = new mongoose.Schema<IApiKey>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true },
    prefix: { type: String, required: true },
    expiresAt: { type: Date },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

apiKeySchema.index({ tenantId: 1 });
apiKeySchema.index({ prefix: 1 });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', apiKeySchema);

// Deployment model
export interface IDeployment {
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
  kubernetesNamespace: string;
  environment: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const deploymentSchema = new mongoose.Schema<IDeployment>(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    port: { type: Number, required: true, default: 8080 },
    subdomain: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'deploying', 'running', 'stopped', 'failed'],
      default: 'pending',
    },
    scaleToZero: { type: Boolean, default: true },
    minReplicas: { type: Number, default: 0 },
    maxReplicas: { type: Number, default: 10 },
    currentReplicas: { type: Number, default: 0 },
    kubernetesNamespace: { type: String, required: true },
    environment: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

deploymentSchema.index({ tenantId: 1, name: 1 });
deploymentSchema.index({ subdomain: 1 });

export const Deployment = mongoose.model<IDeployment>('Deployment', deploymentSchema);

// Usage tracking for billing
export interface IUsageRecord {
  tenantId: string;
  deploymentId: string;
  timestamp: Date;
  durationSeconds: number;
  requestCount: number;
  memoryMbSeconds: number;
  cpuMillisSeconds: number;
}

const usageRecordSchema = new mongoose.Schema<IUsageRecord>(
  {
    tenantId: { type: String, required: true, index: true },
    deploymentId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    durationSeconds: { type: Number, required: true },
    requestCount: { type: Number, default: 0 },
    memoryMbSeconds: { type: Number, default: 0 },
    cpuMillisSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

usageRecordSchema.index({ tenantId: 1, timestamp: -1 });
usageRecordSchema.index({ deploymentId: 1, timestamp: -1 });

export const UsageRecord = mongoose.model<IUsageRecord>('UsageRecord', usageRecordSchema);

// Billing records
export interface IBillingRecord {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  iremboPayTransactionId?: string;
  breakdown: {
    computeCost: number;
    requestCost: number;
    memoryCost: number;
  };
  createdAt: Date;
}

const billingRecordSchema = new mongoose.Schema<IBillingRecord>(
  {
    tenantId: { type: String, required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'RWF' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    iremboPayTransactionId: { type: String },
    breakdown: {
      computeCost: { type: Number, default: 0 },
      requestCost: { type: Number, default: 0 },
      memoryCost: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

billingRecordSchema.index({ tenantId: 1, periodStart: -1 });

export const BillingRecord = mongoose.model<IBillingRecord>('BillingRecord', billingRecordSchema);

// Audit log for compliance and debugging
export interface IAuditLog {
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
