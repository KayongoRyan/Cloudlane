import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
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

const pool = new Pool({ connectionString: config.databaseUrl });

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        owner_id UUID,
        tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'developer' CHECK (role IN ('admin', 'developer', 'viewer')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        prefix TEXT NOT NULL,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS deployments (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        image TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 8080,
        subdomain TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'running', 'stopped', 'failed')),
        scale_to_zero BOOLEAN NOT NULL DEFAULT TRUE,
        min_replicas INTEGER NOT NULL DEFAULT 0,
        max_replicas INTEGER NOT NULL DEFAULT 10,
        current_replicas INTEGER NOT NULL DEFAULT 0,
        kubernetes_namespace TEXT NOT NULL,
        environment JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS usage_records (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ NOT NULL,
        duration_seconds DOUBLE PRECISION NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        memory_mb_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
        cpu_millis_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS billing_records (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        period_start TIMESTAMPTZ NOT NULL,
        period_end TIMESTAMPTZ NOT NULL,
        total_amount NUMERIC NOT NULL,
        currency TEXT NOT NULL DEFAULT 'RWF',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
        irembo_pay_transaction_id TEXT,
        breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON users(tenant_id);
      CREATE INDEX IF NOT EXISTS api_keys_tenant_id_idx ON api_keys(tenant_id);
      CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys(prefix);
      CREATE INDEX IF NOT EXISTS deployments_tenant_id_idx ON deployments(tenant_id);
      CREATE INDEX IF NOT EXISTS usage_records_tenant_timestamp_idx ON usage_records(tenant_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS usage_records_deployment_timestamp_idx ON usage_records(deployment_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS billing_records_tenant_period_idx ON billing_records(tenant_id, period_start DESC);
      CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON audit_logs(tenant_id, created_at DESC);
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function mapTenant(row: any): TenantRecord {
  return { id: row.id, name: row.name, slug: row.slug, ownerId: row.owner_id, tier: row.tier, status: row.status };
}

function mapUser(row: any): UserRecord {
  return { id: row.id, tenantId: row.tenant_id, email: row.email, passwordHash: row.password_hash, role: row.role };
}

function mapDeployment(row: any): DeploymentRecord {
  return {
    id: row.id, tenantId: row.tenant_id, name: row.name, image: row.image, port: row.port,
    subdomain: row.subdomain, status: row.status, scaleToZero: row.scale_to_zero,
    minReplicas: row.min_replicas, maxReplicas: row.max_replicas, currentReplicas: row.current_replicas,
    kubernetesNamespace: row.kubernetes_namespace, environment: row.environment,
  };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return result.rowCount ? mapUser(result.rows[0]) : null;
}

export async function findUserByIdAndTenant(id: string, tenantId: string): Promise<UserRecord | null> {
  const result = await pool.query('SELECT * FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  return result.rowCount ? mapUser(result.rows[0]) : null;
}

export async function createTenant(client: PoolClient, name: string, slug: string): Promise<TenantRecord> {
  const result = await client.query(
    `INSERT INTO tenants (id, name, slug, tier, status) VALUES ($1, $2, $3, 'free', 'active') RETURNING *`,
    [uuidv4(), name, slug]
  );
  return mapTenant(result.rows[0]);
}

export async function createUser(client: PoolClient, tenantId: string, email: string, passwordHash: string): Promise<UserRecord> {
  const result = await client.query(
    `INSERT INTO users (id, tenant_id, email, password_hash, role) VALUES ($1, $2, $3, $4, 'admin') RETURNING *`,
    [uuidv4(), tenantId, email.toLowerCase(), passwordHash]
  );
  return mapUser(result.rows[0]);
}

export async function setTenantOwner(client: PoolClient, tenantId: string, ownerId: string): Promise<void> {
  await client.query('UPDATE tenants SET owner_id = $1, updated_at = NOW() WHERE id = $2', [ownerId, tenantId]);
}

export async function createUserAndTenant(name: string, slug: string, email: string, passwordHash: string): Promise<UserRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tenant = await createTenant(client, name, slug);
    const user = await createUser(client, tenant.id, email, passwordHash);
    await setTenantOwner(client, tenant.id, user.id);
    await client.query('COMMIT');
    return user;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listDeployments(tenantId: string): Promise<DeploymentRecord[]> {
  const result = await pool.query('SELECT * FROM deployments WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
  return result.rows.map(mapDeployment);
}

export async function createDeployment(input: Omit<DeploymentRecord, 'id'>): Promise<DeploymentRecord> {
  const result = await pool.query(
    `INSERT INTO deployments (id, tenant_id, name, image, port, subdomain, status, scale_to_zero, min_replicas, max_replicas, current_replicas, kubernetes_namespace, environment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb) RETURNING *`,
    [uuidv4(), input.tenantId, input.name, input.image, input.port, input.subdomain, input.status,
      input.scaleToZero, input.minReplicas, input.maxReplicas, input.currentReplicas, input.kubernetesNamespace,
      JSON.stringify(input.environment)]
  );
  return mapDeployment(result.rows[0]);
}

export async function updateDeploymentStatus(id: string, status: DeploymentStatus): Promise<DeploymentRecord> {
  const result = await pool.query('UPDATE deployments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);
  if (!result.rowCount) throw new Error('Deployment not found');
  return mapDeployment(result.rows[0]);
}

export async function findApiKey(prefix: string, keyHash: string): Promise<ApiKeyRecord | null> {
  const result = await pool.query('SELECT id, tenant_id, key_hash, prefix FROM api_keys WHERE prefix = $1 AND key_hash = $2', [prefix, keyHash]);
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { id: row.id, tenantId: row.tenant_id, keyHash: row.key_hash, prefix: row.prefix };
}

export async function markApiKeyUsed(id: string): Promise<void> {
  await pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [id]);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
