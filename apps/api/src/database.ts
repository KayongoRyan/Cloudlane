import { v4 as uuidv4 } from 'uuid';
import { MongoClient, Db, Collection } from 'mongodb';
import config from './config';

export type TenantTier = 'free' | 'pro' | 'enterprise';
export type TenantStatus = 'active' | 'suspended' | 'deleted';
export type UserRole = 'admin' | 'developer' | 'viewer';
export type DeploymentStatus = 'pending' | 'deploying' | 'running' | 'stopped' | 'failed';

export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  ownerId: string | null;
  tier: TenantTier;
  status: TenantStatus;
}

export interface UserRecord {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface DeploymentRecord {
  id: string;
  tenantId: string;
  name: string;
  image: string;
  port: number;
  subdomain: string;
  status: DeploymentStatus;
  scaleToZero: boolean;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
  kubernetesNamespace: string;
  environment: Record<string, string>;
}

interface ApiKeyRecord {
  id: string;
  tenantId: string;
  keyHash: string;
  prefix: string;
}

let client: MongoClient | null = null;
let db: Db | null = null;

let tenantsCol: Collection | null = null;
let usersCol: Collection | null = null;
let deploymentsCol: Collection | null = null;
let apiKeysCol: Collection | null = null;

function mapTenant(doc: any): TenantRecord {
  return { id: doc.id, name: doc.name, slug: doc.slug, ownerId: doc.ownerId ?? null, tier: doc.tier, status: doc.status };
}

function mapUser(doc: any): UserRecord {
  return { id: doc.id, tenantId: doc.tenantId, email: doc.email, passwordHash: doc.passwordHash, role: doc.role };
}

function mapDeployment(doc: any): DeploymentRecord {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    name: doc.name,
    image: doc.image,
    port: doc.port,
    subdomain: doc.subdomain,
    status: doc.status,
    scaleToZero: doc.scaleToZero,
    minReplicas: doc.minReplicas,
    maxReplicas: doc.maxReplicas,
    currentReplicas: doc.currentReplicas,
    kubernetesNamespace: doc.kubernetesNamespace,
    environment: doc.environment || {},
  };
}

export async function initializeDatabase(): Promise<void> {
  const url = config.databaseUrl;
  if (!url || !url.startsWith('mongodb')) {
    throw new Error('DATABASE_URL must be a mongodb:// URL when using MongoDB backend');
  }

  client = new MongoClient(url);
  await client.connect();
  db = client.db();

  tenantsCol = db.collection('tenants');
  usersCol = db.collection('users');
  deploymentsCol = db.collection('deployments');
  apiKeysCol = db.collection('api_keys');

  // Create indexes similar to SQL constraints
  await tenantsCol.createIndex({ slug: 1 }, { unique: true });
  await usersCol.createIndex({ email: 1 }, { unique: true });
  await apiKeysCol.createIndex({ prefix: 1 });
  await deploymentsCol.createIndex({ subdomain: 1 }, { unique: true });
  await usersCol.createIndex({ tenantId: 1 });
  await apiKeysCol.createIndex({ tenantId: 1 });
  await deploymentsCol.createIndex({ tenantId: 1 });
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
  const doc = await usersCol.findOne({ id, tenantId });
  return doc ? mapUser(doc) : null;
}

export async function createTenant(name: string, slug: string): Promise<TenantRecord> {
  if (!tenantsCol) throw new Error('DB not initialized');
  const doc = { id: uuidv4(), name, slug, ownerId: null, tier: 'free', status: 'active' } as any;
  await tenantsCol.insertOne(doc);
  return mapTenant(doc);
}

export async function createUser(tenantId: string, email: string, passwordHash: string): Promise<UserRecord> {
  if (!usersCol) throw new Error('DB not initialized');
  const doc = { id: uuidv4(), tenantId, email: email.toLowerCase(), passwordHash, role: 'admin' } as any;
  await usersCol.insertOne(doc);
  return mapUser(doc);
}

export async function setTenantOwner(tenantId: string, ownerId: string): Promise<void> {
  if (!tenantsCol) throw new Error('DB not initialized');
  await tenantsCol.updateOne({ id: tenantId }, { $set: { ownerId } });
}

export async function createUserAndTenant(name: string, slug: string, email: string, passwordHash: string): Promise<UserRecord> {
  if (!tenantsCol || !usersCol) throw new Error('DB not initialized');

  // Standalone Mongo (local docker) has no replica set — skip multi-doc transactions.
  const tenant = { id: uuidv4(), name, slug, ownerId: null, tier: 'free', status: 'active' } as any;
  await tenantsCol.insertOne(tenant);

  try {
    const userDoc = {
      id: uuidv4(),
      tenantId: tenant.id,
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin',
    } as any;
    await usersCol.insertOne(userDoc);
    await tenantsCol.updateOne({ id: tenant.id }, { $set: { ownerId: userDoc.id } });
    return mapUser(userDoc);
  } catch (err) {
    await tenantsCol.deleteOne({ id: tenant.id }).catch(() => undefined);
    throw err;
  }
}

export async function listDeployments(tenantId: string): Promise<DeploymentRecord[]> {
  if (!deploymentsCol) throw new Error('DB not initialized');
  const docs = await deploymentsCol.find({ tenantId }).sort({ createdAt: -1 }).toArray();
  return docs.map(mapDeployment);
}

export async function createDeployment(input: Omit<DeploymentRecord, 'id'>): Promise<DeploymentRecord> {
  if (!deploymentsCol) throw new Error('DB not initialized');
  const doc = { id: uuidv4(), ...input, createdAt: new Date(), updatedAt: new Date() } as any;
  await deploymentsCol.insertOne(doc);
  return mapDeployment(doc);
}

export async function updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<DeploymentRecord> {
  if (!deploymentsCol) throw new Error('DB not initialized');
  const res = await deploymentsCol.findOneAndUpdate({ id }, { $set: { status, updatedAt: new Date() } }, { returnDocument: 'after' as any });
  if (!res.value) throw new Error('Deployment not found');
  return mapDeployment(res.value);
}

export async function findApiKey(prefix: string, keyHash: string): Promise<ApiKeyRecord | null> {
  if (!apiKeysCol) throw new Error('DB not initialized');
  const doc = await apiKeysCol.findOne({ prefix, keyHash });
  if (!doc) return null;
  return { id: doc.id, tenantId: doc.tenantId, keyHash: doc.keyHash, prefix: doc.prefix };
}

export async function markApiKeyUsed(id: string): Promise<void> {
  if (!apiKeysCol) throw new Error('DB not initialized');
  await apiKeysCol.updateOne({ id }, { $set: { lastUsedAt: new Date() } });
}

