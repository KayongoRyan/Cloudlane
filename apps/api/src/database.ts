import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import dns from 'node:dns';
import config from './config';

try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '9.9.9.9']);
} catch {
  /* older Node */
}

/** Skip mongodb+srv SRV lookup — it hangs on Netlify/AWS and 502s the function. */
function toDirectMongoUrl(url: string): string {
  if (!url.startsWith('mongodb+srv://')) return url;
  try {
    const parsed = new URL(url.replace('mongodb+srv://', 'https://'));
    const user = parsed.username;
    const pass = parsed.password;
    const dbName = parsed.pathname.replace(/^\//, '') || 'cloudlane';
    if (!parsed.hostname.endsWith('3dn8fdi.mongodb.net')) return url;

    const hosts = [
      'ac-eqdfsxk-shard-00-00.3dn8fdi.mongodb.net:27017',
      'ac-eqdfsxk-shard-00-01.3dn8fdi.mongodb.net:27017',
      'ac-eqdfsxk-shard-00-02.3dn8fdi.mongodb.net:27017',
    ].join(',');

    return `mongodb://${user}:${pass}@${hosts}/${dbName}?ssl=true&retryWrites=true&w=majority&authSource=admin`;
  } catch {
    return url;
  }
}

export type TenantTier = 'free' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'deleted';
export type UserRole = 'admin' | 'developer' | 'viewer';
export type UserStatus = 'active' | 'invited' | 'disabled';
export type DeploymentStatus = 'pending' | 'deploying' | 'running' | 'stopped' | 'failed';

export interface TenantLimits {
  maxDeployments: number;
  maxCpu: number;
  maxMemoryMb: number;
  maxInstances: number;
}

export const DEFAULT_TENANT_LIMITS: TenantLimits = {
  maxDeployments: 8,
  maxCpu: 1,
  maxMemoryMb: 512,
  maxInstances: 3,
};

/** API-facing records — `_id` and FKs are ObjectId hex strings. */
export interface TenantRecord {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  tier: TenantTier;
  limits: TenantLimits;
  irembopayCustomerId: string | null;
  createdAt: Date;
}

export interface UserRecord {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
}

export interface DeploymentRecord {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  image: string;
  cpu: number;
  memory: number;
  minInstances: number;
  maxInstances: number;
  status: DeploymentStatus;
  publicUrl: string;
  k8sNamespace: string;
  port: number;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
}

export interface AuditLogRecord {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  changes: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
}

export interface UsageMetricRecord {
  id: string;
  tenantId: string;
  deploymentId: string;
  metricType: string;
  value: number;
  windowStart: Date;
  windowEnd: Date;
}

let client: MongoClient | null = null;
let db: Db | null = null;

let tenantsCol: Collection | null = null;
let usersCol: Collection | null = null;
let deploymentsCol: Collection | null = null;
let apiKeysCol: Collection | null = null;
let auditLogsCol: Collection | null = null;
let usageMetricsCol: Collection | null = null;

export function isObjectIdString(value: string): boolean {
  return ObjectId.isValid(value) && String(new ObjectId(value)) === value;
}

function asObjectId(value: string): ObjectId {
  return new ObjectId(value);
}

function oidOrRaw(value: string): ObjectId | string {
  return isObjectIdString(value) ? asObjectId(value) : value;
}

/** Match both new ObjectId FKs and legacy UUID-string FKs. */
function tenantClause(tenantId: string): { tenantId: { $in: Array<ObjectId | string> } } {
  const vals: Array<ObjectId | string> = [tenantId];
  if (isObjectIdString(tenantId)) vals.push(asObjectId(tenantId));
  return { tenantId: { $in: vals } };
}

function idOf(doc: { _id: ObjectId }): string {
  return doc._id.toHexString();
}

function refStr(value: unknown): string {
  if (value instanceof ObjectId) return value.toHexString();
  return value != null ? String(value) : '';
}

function mapLimits(raw: unknown): TenantLimits {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<TenantLimits>;
  return {
    maxDeployments: o.maxDeployments ?? DEFAULT_TENANT_LIMITS.maxDeployments,
    maxCpu: o.maxCpu ?? DEFAULT_TENANT_LIMITS.maxCpu,
    maxMemoryMb: o.maxMemoryMb ?? DEFAULT_TENANT_LIMITS.maxMemoryMb,
    maxInstances: o.maxInstances ?? DEFAULT_TENANT_LIMITS.maxInstances,
  };
}

function mapTenant(doc: any): TenantRecord {
  return {
    id: idOf(doc),
    slug: doc.slug,
    name: doc.name,
    status: doc.status,
    tier: doc.tier,
    limits: mapLimits(doc.limits),
    irembopayCustomerId: doc.irembopayCustomerId ?? null,
    createdAt: doc.createdAt ?? new Date(0),
  };
}

function mapUser(doc: any): UserRecord {
  return {
    id: idOf(doc),
    tenantId: refStr(doc.tenantId),
    email: doc.email,
    passwordHash: doc.passwordHash,
    role: doc.role,
    status: doc.status ?? 'active',
    createdAt: doc.createdAt ?? new Date(0),
  };
}

function mapDeployment(doc: any): DeploymentRecord {
  const slug = doc.slug || doc.name;
  const publicUrl =
    doc.publicUrl ||
    (doc.subdomain ? `https://${doc.subdomain}.${config.baseDomain}` : '');
  return {
    id: idOf(doc),
    tenantId: refStr(doc.tenantId),
    name: doc.name,
    slug,
    image: doc.image,
    cpu: doc.cpu ?? 0.5,
    memory: doc.memory ?? 256,
    minInstances: doc.minInstances ?? doc.minReplicas ?? 0,
    maxInstances: doc.maxInstances ?? doc.maxReplicas ?? 3,
    status: doc.status,
    publicUrl,
    k8sNamespace: doc.k8sNamespace || doc.kubernetesNamespace || '',
    port: doc.port ?? 8080,
    deletedAt: doc.deletedAt ?? null,
    createdAt: doc.createdAt ?? new Date(0),
  };
}

function mapApiKey(doc: any): ApiKeyRecord {
  return {
    id: idOf(doc),
    tenantId: refStr(doc.tenantId),
    userId: refStr(doc.userId),
    name: doc.name || 'default',
    keyHash: doc.keyHash,
    prefix: doc.prefix,
    scopes: Array.isArray(doc.scopes) ? doc.scopes : ['deploy', 'read'],
    expiresAt: doc.expiresAt ?? null,
    lastUsedAt: doc.lastUsedAt ?? null,
  };
}

function mapAuditLog(doc: any): AuditLogRecord {
  return {
    id: idOf(doc),
    tenantId: refStr(doc.tenantId),
    userId: doc.userId ? refStr(doc.userId) : null,
    action: doc.action,
    resourceType: doc.resourceType,
    resourceId: doc.resourceId ? refStr(doc.resourceId) : null,
    changes: doc.changes && typeof doc.changes === 'object' ? doc.changes : {},
    ipAddress: doc.ipAddress ?? null,
    createdAt: doc.createdAt ?? new Date(0),
  };
}

function mapUsageMetric(doc: any): UsageMetricRecord {
  return {
    id: idOf(doc),
    tenantId: refStr(doc.tenantId),
    deploymentId: refStr(doc.deploymentId),
    metricType: doc.metricType,
    value: doc.value,
    windowStart: doc.windowStart,
    windowEnd: doc.windowEnd,
  };
}

function publicApiKey(record: ApiKeyRecord) {
  const { keyHash: _omit, ...rest } = record;
  return rest;
}

export async function initializeDatabase(): Promise<void> {
  if (client && usersCol) return;

  const url = toDirectMongoUrl(config.databaseUrl);
  if (!url || !url.startsWith('mongodb')) {
    const hint = config.isNetlify
      ? 'Set DATABASE_URL in Netlify → Environment variables (MongoDB Atlas URI).'
      : 'DATABASE_URL must be a mongodb:// or mongodb+srv:// URL.';
    throw new Error(hint);
  }

  if (config.isNetlify && url.includes('localhost')) {
    throw new Error('DATABASE_URL cannot point to localhost on Netlify. Use MongoDB Atlas.');
  }

  try {
    client = new MongoClient(url, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000,
      socketTimeoutMS: 4000,
      family: 4,
    });
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('MongoDB connect timed out. Check Atlas Network Access (0.0.0.0/0) and DATABASE_URL.')), 4500);
      }),
    ]);
    db = client.db();

    tenantsCol = db.collection('tenants');
    usersCol = db.collection('users');
    deploymentsCol = db.collection('deployments');
    apiKeysCol = db.collection('api_keys');
    auditLogsCol = db.collection('audit_logs');
    usageMetricsCol = db.collection('usage_metrics');

    // Indexes on every cold start make Netlify functions time out — skip in serverless.
    if (!config.isNetlify) {
      await tenantsCol.createIndex({ slug: 1 }, { unique: true });
      await usersCol.createIndex({ email: 1 }, { unique: true });
      await usersCol.createIndex({ tenantId: 1 });
      await deploymentsCol.createIndex({ publicUrl: 1 }, { unique: true, sparse: true });
      await deploymentsCol.createIndex({ tenantId: 1, slug: 1 });
      await deploymentsCol.createIndex({ tenantId: 1 });
      await apiKeysCol.createIndex({ prefix: 1 });
      await apiKeysCol.createIndex({ tenantId: 1 });
      await apiKeysCol.createIndex({ userId: 1 });
      await auditLogsCol.createIndex({ tenantId: 1, createdAt: -1 });
      await usageMetricsCol.createIndex({ tenantId: 1, deploymentId: 1, windowStart: -1 });
    }
  } catch (err) {
    try { await client?.close(); } catch { /* ignore */ }
    client = null;
    db = null;
    tenantsCol = null;
    usersCol = null;
    deploymentsCol = null;
    apiKeysCol = null;
    auditLogsCol = null;
    usageMetricsCol = null;
    throw err;
  }
}

export async function closeDatabase(): Promise<void> {
  if (client) await client.close();
  client = null;
  db = null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  if (!usersCol) throw new Error('DB not initialized');
  const doc = await usersCol.findOne({ email: email.toLowerCase() });
  return doc ? mapUser(doc) : null;
}

export async function findUserByIdAndTenant(id: string, tenantId: string): Promise<UserRecord | null> {
  if (!usersCol) throw new Error('DB not initialized');

  if (isObjectIdString(id)) {
    const doc = await usersCol.findOne({ _id: asObjectId(id), ...tenantClause(tenantId) });
    if (doc) return mapUser(doc);
  }

  // Legacy UUID `id` field from pre-ERD documents
  const legacy = await usersCol.findOne({ id, ...tenantClause(tenantId) });
  return legacy ? mapUser(legacy) : null;
}

export async function createTenant(name: string, slug: string): Promise<TenantRecord> {
  if (!tenantsCol) throw new Error('DB not initialized');
  const doc = {
    slug,
    name,
    status: 'active' as TenantStatus,
    tier: 'free' as TenantTier,
    limits: { ...DEFAULT_TENANT_LIMITS },
    irembopayCustomerId: null,
    createdAt: new Date(),
  };
  const result = await tenantsCol.insertOne(doc);
  return mapTenant({ ...doc, _id: result.insertedId });
}

export async function createUser(tenantId: string, email: string, passwordHash: string): Promise<UserRecord> {
  if (!usersCol) throw new Error('DB not initialized');
  const doc = {
    tenantId: oidOrRaw(tenantId),
    email: email.toLowerCase(),
    passwordHash,
    role: 'admin' as UserRole,
    status: 'active' as UserStatus,
    createdAt: new Date(),
  };
  const result = await usersCol.insertOne(doc);
  return mapUser({ ...doc, _id: result.insertedId });
}

export async function createUserAndTenant(name: string, slug: string, email: string, passwordHash: string): Promise<UserRecord> {
  if (!tenantsCol || !usersCol) throw new Error('DB not initialized');

  const tenant = {
    slug,
    name,
    status: 'active' as TenantStatus,
    tier: 'free' as TenantTier,
    limits: { ...DEFAULT_TENANT_LIMITS },
    irembopayCustomerId: null,
    createdAt: new Date(),
  };
  const tenantResult = await tenantsCol.insertOne(tenant);

  try {
    const userDoc = {
      tenantId: tenantResult.insertedId,
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin' as UserRole,
      status: 'active' as UserStatus,
      createdAt: new Date(),
    };
    const userResult = await usersCol.insertOne(userDoc);
    return mapUser({ ...userDoc, _id: userResult.insertedId });
  } catch (err) {
    await tenantsCol.deleteOne({ _id: tenantResult.insertedId }).catch(() => undefined);
    throw err;
  }
}

export async function listDeployments(tenantId: string): Promise<DeploymentRecord[]> {
  if (!deploymentsCol) throw new Error('DB not initialized');
  const docs = await deploymentsCol
    .find({
      ...tenantClause(tenantId),
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(mapDeployment);
}

export async function findDeploymentById(id: string, tenantId: string): Promise<DeploymentRecord | null> {
  if (!deploymentsCol) throw new Error('DB not initialized');
  if (!isObjectIdString(id)) return null;
  const doc = await deploymentsCol.findOne({
    _id: asObjectId(id),
    ...tenantClause(tenantId),
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });
  return doc ? mapDeployment(doc) : null;
}

export interface CreateDeploymentInput {
  tenantId: string;
  name: string;
  slug: string;
  image: string;
  cpu?: number;
  memory?: number;
  minInstances?: number;
  maxInstances?: number;
  status: DeploymentStatus;
  publicUrl: string;
  k8sNamespace: string;
  port: number;
}

export async function createDeployment(input: CreateDeploymentInput): Promise<DeploymentRecord> {
  if (!deploymentsCol) throw new Error('DB not initialized');
  const now = new Date();
  const doc = {
    tenantId: oidOrRaw(input.tenantId),
    name: input.name,
    slug: input.slug,
    image: input.image,
    cpu: input.cpu ?? 0.5,
    memory: input.memory ?? 256,
    minInstances: input.minInstances ?? 0,
    maxInstances: input.maxInstances ?? 3,
    status: input.status,
    publicUrl: input.publicUrl,
    k8sNamespace: input.k8sNamespace,
    port: input.port,
    deletedAt: null,
    createdAt: now,
  };
  const result = await deploymentsCol.insertOne(doc);
  return mapDeployment({ ...doc, _id: result.insertedId });
}

export async function updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<DeploymentRecord> {
  if (!deploymentsCol) throw new Error('DB not initialized');
  if (!isObjectIdString(id)) throw new Error('Deployment not found');
  const res = await deploymentsCol.findOneAndUpdate(
    { _id: asObjectId(id) },
    { $set: { status } },
    { returnDocument: 'after' as const }
  );
  if (!res.value) throw new Error('Deployment not found');
  return mapDeployment(res.value);
}

export async function findApiKey(prefix: string, keyHash: string): Promise<ApiKeyRecord | null> {
  if (!apiKeysCol) throw new Error('DB not initialized');
  const doc = await apiKeysCol.findOne({ prefix, keyHash });
  if (!doc) return null;
  if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) return null;
  return mapApiKey(doc);
}

export async function markApiKeyUsed(id: string): Promise<void> {
  if (!apiKeysCol) throw new Error('DB not initialized');
  if (!isObjectIdString(id)) return;
  await apiKeysCol.updateOne({ _id: asObjectId(id) }, { $set: { lastUsedAt: new Date() } });
}

export async function listApiKeys(tenantId: string): Promise<Omit<ApiKeyRecord, 'keyHash'>[]> {
  if (!apiKeysCol) throw new Error('DB not initialized');
  const docs = await apiKeysCol.find(tenantClause(tenantId)).sort({ _id: -1 }).toArray();
  return docs.map((d) => publicApiKey(mapApiKey(d)));
}

export async function createApiKey(input: {
  tenantId: string;
  userId: string;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
}): Promise<Omit<ApiKeyRecord, 'keyHash'>> {
  if (!apiKeysCol) throw new Error('DB not initialized');
  const doc = {
    tenantId: oidOrRaw(input.tenantId),
    userId: oidOrRaw(input.userId),
    name: input.name,
    keyHash: input.keyHash,
    prefix: input.prefix,
    scopes: input.scopes,
    expiresAt: input.expiresAt,
    lastUsedAt: null,
  };
  const result = await apiKeysCol.insertOne(doc);
  return publicApiKey(mapApiKey({ ...doc, _id: result.insertedId }));
}

export async function deleteApiKey(id: string, tenantId: string): Promise<boolean> {
  if (!apiKeysCol) throw new Error('DB not initialized');
  if (!isObjectIdString(id)) return false;
  const res = await apiKeysCol.deleteOne({ _id: asObjectId(id), ...tenantClause(tenantId) });
  return res.deletedCount === 1;
}

export async function writeAuditLog(input: {
  tenantId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  changes?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  if (!auditLogsCol) return;
  try {
    await auditLogsCol.insertOne({
      tenantId: oidOrRaw(input.tenantId),
      userId: input.userId ? oidOrRaw(input.userId) : null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId && isObjectIdString(input.resourceId) ? asObjectId(input.resourceId) : input.resourceId ?? null,
      changes: input.changes ?? {},
      ipAddress: input.ipAddress ?? null,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('audit log write failed:', err);
  }
}

export async function listAuditLogs(tenantId: string, limit = 50): Promise<AuditLogRecord[]> {
  if (!auditLogsCol) throw new Error('DB not initialized');
  const docs = await auditLogsCol
    .find(tenantClause(tenantId))
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .toArray();
  return docs.map(mapAuditLog);
}

export async function createUsageMetric(input: {
  tenantId: string;
  deploymentId: string;
  metricType: string;
  value: number;
  windowStart: Date;
  windowEnd: Date;
}): Promise<UsageMetricRecord> {
  if (!usageMetricsCol) throw new Error('DB not initialized');
  const doc = {
    tenantId: oidOrRaw(input.tenantId),
    deploymentId: oidOrRaw(input.deploymentId),
    metricType: input.metricType,
    value: input.value,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
  };
  const result = await usageMetricsCol.insertOne(doc);
  return mapUsageMetric({ ...doc, _id: result.insertedId });
}

export async function listUsageMetrics(
  tenantId: string,
  deploymentId?: string,
  limit = 100
): Promise<UsageMetricRecord[]> {
  if (!usageMetricsCol) throw new Error('DB not initialized');
  const filter: Record<string, unknown> = { ...tenantClause(tenantId) };
  if (deploymentId) {
    const vals: Array<ObjectId | string> = [deploymentId];
    if (isObjectIdString(deploymentId)) vals.push(asObjectId(deploymentId));
    filter.deploymentId = { $in: vals };
  }
  const docs = await usageMetricsCol
    .find(filter)
    .sort({ windowStart: -1 })
    .limit(Math.min(Math.max(limit, 1), 500))
    .toArray();
  return docs.map(mapUsageMetric);
}
