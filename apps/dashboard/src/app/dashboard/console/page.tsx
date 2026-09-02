'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { ConsoleTopBar } from '../../../components/ConsoleTopBar'
import ConsoleHub from '../../../components/ConsoleHub'
import { pushRecentService } from '../../../components/recentServices'
import { useConsoleShell } from '../../../lib/useConsoleShell'
import ConsoleNav, {
  COMPUTE_VM_TABS,
  GATEWAY_TABS,
  LB_TABS,
  SECRET_TABS,
  SQL_INSTANCE_TABS,
  IAM_PROJECT_TABS,
  isOverviewTab,
  isProductStubTab,
  K8S_DEPLOY_TABS,
  MONITORING_LIVE_TABS,
  RUN_DEPLOY_TABS,
  SECURITY_AUDIT_TABS,
  SQL_GET_STARTED_TABS,
  SQL_BACKUP_TABS,
  PRODUCT_IDS,
  SERVICE_LABELS,
  type ServiceId,
} from '../../../components/ConsoleNav'
import ServiceProductOverview from '../../../components/ServiceProductOverview'
import { getApiBase } from '../../../lib/api'

interface Project {
  id: string
  name: string
  slug: string
}

interface Deployment {
  id: string
  name: string
  image: string
  publicUrl?: string
  status: string
  statusMessage?: string
  port: number
  projectId?: string
  createdAt?: string
}

interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt?: string
}

interface Bucket {
  id: string
  name: string
  projectId?: string
}

interface Vm {
  id: string
  name: string
  cpu: number
  memoryMb: number
  status: string
  publicIp?: string
}

interface GatewayRow {
  id: string
  name: string
  slug: string
  status: string
  hostnames: string[]
  defaultStage: string
  routeCount?: number
  projectId?: string
}

interface GatewayRouteRow {
  id: string
  gatewayId: string
  stage: string
  method: string
  path: string
  targetDeploymentId: string
  stripPathPrefix: boolean
}

interface GatewayKeyRow {
  id: string
  name: string
  prefix: string
  scopes: string[]
  rateLimitRpm: number
  lastUsedAt?: string
}

interface SecretRow {
  id: string
  name: string
  version: number
  createdAt?: string
  value?: string
}

interface OpsSecretRow {
  name: string
  description: string
  scope: string
  inVault: boolean
  inEnv: boolean
  version?: number | null
  updatedAt?: string | null
  value?: string
}

interface LoadBalancerRow {
  id: string
  name: string
  scheme: string
  protocol: string
  port: number
  dnsName?: string
  status: string
  statusMessage?: string
  targetDeploymentId?: string
}

interface DatabaseInstanceRow {
  id: string
  name: string
  engine: string
  version: string
  sizeGb: number
  diskUsedMb?: number
  dedicated?: boolean
  endpoint?: string
  status: string
  statusMessage?: string
  connectionString?: string
  lastBackupAt?: string
}

interface Invoice {
  id: string
  totalAmount: number
  currency: string
  status: string
  createdAt?: string
  irembopayPaymentLinkUrl?: string
  irembopayInvoiceNumber?: string
  irembopayPaymentStatus?: string
}

interface MonitoringSummary {
  deployments: { total: number; running: number; failed: number }
  metricsByType: Record<string, number>
  recentMetrics: { metricType: string; value: number; windowStart: string }[]
}

interface QuotaReport {
  limits: {
    maxDeployments: number
    maxCpu: number
    maxMemoryMb: number
    maxInstances: number
    maxBuckets: number
    maxSecrets: number
    maxLoadBalancers: number
    maxDatabaseInstances: number
  }
  usage: {
    deployments: number
    totalCpu: number
    totalMemoryMb: number
    totalMaxInstances: number
    buckets: number
    secrets: number
    loadBalancers: number
    databaseInstances: number
  }
  available: {
    deployments: number
    cpu: number
    memoryMb: number
    buckets: number
    secrets: number
    loadBalancers: number
    databaseInstances: number
    maxInstancesPerDeployment?: number
  }
}

interface AuditLog {
  id: string
  action: string
  resourceType: string
  createdAt?: string
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { headers: authHeaders() })
  const text = await res.text()
  let body: Record<string, unknown> = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    /* html / plain */
  }
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) {
    const msg =
      (typeof body.detail === 'string' && body.detail)
      || (typeof body.error === 'string' && body.error)
      || (res.status === 404 ? `Not found: ${path}` : null)
      || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return (text ? JSON.parse(text) : {}) as T
}

async function apiSend<T = unknown>(path: string, method: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    /* html / plain */
  }
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) {
    const msg =
      (typeof data.detail === 'string' && data.detail)
      || (typeof data.error === 'string' && data.error)
      || (res.status === 404 ? `Not found: ${path}` : null)
      || `Request failed (${res.status})`
    throw new Error(msg)
  }
  if (res.status === 204) return null
  return (text ? JSON.parse(text) : null) as T
}

export default function ConsolePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const topbarRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const tabParam = searchParams.get('tab') as ServiceId | null
  const isHubView = !tabParam
  const [tab, setTab] = useState<ServiceId>(tabParam ?? 'run-services')
  const [navOpen, setNavOpen] = useState(false)
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null)
  const [projectId, setProjectId] = useState<string>('')
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [deployForm, setDeployForm] = useState({ name: '', image: '', port: 8080, minInstances: 0, maxInstances: 3 })
  const [projectName, setProjectName] = useState('')
  const [bucketName, setBucketName] = useState('')
  const [vmForm, setVmForm] = useState({ name: '', cpu: 1, memoryMb: 512 })
  const [secretForm, setSecretForm] = useState({ name: '', value: '' })
  const [lbForm, setLbForm] = useState({ name: '', protocol: 'HTTP', port: 80, targetDeploymentId: '' })
  const [dbForm, setDbForm] = useState({ name: '', engine: 'postgres', version: '16', sizeGb: 10, dedicated: false })
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; value: string } | null>(null)
  const [revealedOpsSecret, setRevealedOpsSecret] = useState<{ name: string; value: string } | null>(null)
  const [revealedDb, setRevealedDb] = useState<{ id: string; connectionString: string } | null>(null)
  const [gatewayName, setGatewayName] = useState('')
  const [selectedGatewayId, setSelectedGatewayId] = useState('')
  const [routeForm, setRouteForm] = useState({ method: 'GET', path: '/v1/', targetDeploymentId: '', stage: 'prod' })
  const [newGatewayKey, setNewGatewayKey] = useState<string | null>(null)
  const [deployConfig, setDeployConfig] = useState('')
  const [selectedBucket, setSelectedBucket] = useState('')
  const [bucketObjects, setBucketObjects] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [lastPaymentLink, setLastPaymentLink] = useState<string | null>(null)

  const fetcher = useCallback(async <T,>(path: string): Promise<T> => {
    try {
      return await apiGet<T>(path)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'unauthorized') {
        router.push('/')
      }
      throw err
    }
  }, [router])

  const { data: projectsData, mutate: mutateProjects } = useSWR(
    'console-projects',
    () => fetcher<{ projects: Project[] }>('/api/projects'),
  )
  const projects = projectsData?.projects ?? []

  useConsoleShell(isHubView ? false : navOpen, topbarRef)

  useEffect(() => {
    fetch(`${getApiBase()}/health`)
      .then((r) => setApiHealthy(r.ok))
      .catch(() => setApiHealthy(false))
  }, [])

  useEffect(() => {
    if (tabParam) setTab(tabParam)
  }, [tabParam])

  useEffect(() => {
    if (!projectId && projects.length) {
      setProjectId(projects[0].id)
    }
  }, [projects, projectId])

  const projectQuery = projectId ? `?projectId=${projectId}` : ''
  const { data: depData, mutate: mutateDeps } = useSWR(
    ['console-deployments', projectId],
    () => fetcher<{ deployments: Deployment[] }>(`/api/deployments${projectQuery}`),
  )

  useEffect(() => {
    const deps = depData?.deployments ?? []
    const provisioning = deps.some(
      (d) => d.status === 'provisioning' || d.status === 'deploying',
    )
    if (!provisioning) return
    const id = setInterval(() => {
      void mutateDeps()
    }, 3000)
    return () => clearInterval(id)
  }, [depData, mutateDeps])

  const showDeployments =
    RUN_DEPLOY_TABS.includes(tab) ||
    K8S_DEPLOY_TABS.includes(tab) ||
    tab === 'hub-deployments' ||
    tab === 'solutions-deployments'

  const showMonitoring = MONITORING_LIVE_TABS.includes(tab)
  const showSqlGetStarted = tab === 'db-cloud-sql' || SQL_GET_STARTED_TABS.includes(tab)
  const showSecurity = SECURITY_AUDIT_TABS.includes(tab)
  const showComputeVms = COMPUTE_VM_TABS.includes(tab)
  const showIamProjects = IAM_PROJECT_TABS.includes(tab)
  const showApiKeys = tab === 'apis-credentials' || tab === 'agent'
  const showGateway = GATEWAY_TABS.includes(tab)
  const showSecrets = SECRET_TABS.includes(tab)
  const showLoadBalancers = LB_TABS.includes(tab)
  const showSqlInstances = SQL_INSTANCE_TABS.includes(tab)
  const showSqlBackups = SQL_BACKUP_TABS.includes(tab)
  const parentOverviewTabs: ServiceId[] = ['apis', 'vpc', 'bigquery', 'databases', 'hub-home']
  const showProductOverview = isOverviewTab(tab) || isProductStubTab(tab) || parentOverviewTabs.includes(tab)

  const { data: keysData, mutate: mutateKeys } = useSWR(
    showApiKeys ? 'console-keys' : null,
    () => fetcher<{ apiKeys: ApiKeyRow[] }>('/api/api-keys'),
  )
  const { data: bucketsData, mutate: mutateBuckets } = useSWR(
    tab === 'storage' || showProductOverview ? ['console-buckets', projectId] : null,
    () => fetcher<{ buckets: Bucket[] }>(`/api/buckets${projectQuery}`),
  )
  const { data: billingUsage, mutate: mutateBilling } = useSWR(
    tab === 'billing' ? 'console-usage' : null,
    () => fetcher<{ usage: { computeSeconds: number; estimatedCost: number; currency: string } }>('/api/billing/usage'),
  )
  const { data: invoicesData, mutate: mutateInvoices } = useSWR(
    tab === 'billing' ? 'console-invoices' : null,
    () => fetcher<{ invoices: Invoice[] }>('/api/billing/invoices'),
  )
  const { data: monitoring, mutate: mutateMonitoring } = useSWR(
    isHubView || showMonitoring ? 'console-monitoring' : null,
    () => fetcher<MonitoringSummary>('/api/monitoring/summary'),
  )
  const { data: quotaReport } = useSWR(
    tab === 'hub-quotas' || tab === 'iam-quotas' ? 'console-quota' : null,
    () => fetcher<QuotaReport>('/api/quota'),
  )
  const { data: vmsData, mutate: mutateVms } = useSWR(
    showComputeVms ? ['console-vms', projectId] : null,
    () => fetcher<{ vms: Vm[] }>(`/api/vms${projectQuery}`),
  )
  const { data: auditData } = useSWR(
    showSecurity ? 'console-audit' : null,
    () => fetcher<{ auditLogs: AuditLog[] }>('/api/audit-logs'),
  )
  const { data: gatewaysData, mutate: mutateGateways } = useSWR(
    showGateway || showProductOverview ? ['console-gateways', projectId] : null,
    () => fetcher<{ gateways: GatewayRow[] }>(`/api/gateways${projectQuery}`),
  )
  const activeGatewayId = selectedGatewayId || gatewaysData?.gateways?.[0]?.id || ''
  const { data: gatewayRoutesData, mutate: mutateGatewayRoutes } = useSWR(
    showGateway && activeGatewayId && (tab === 'gateway-routes' || tab === 'gateway-deploy')
      ? ['console-gateway-routes', activeGatewayId]
      : null,
    () => fetcher<{ routes: GatewayRouteRow[] }>(`/api/gateways/${activeGatewayId}/routes`),
  )
  const { data: gatewayKeysData, mutate: mutateGatewayKeys } = useSWR(
    showGateway && activeGatewayId && tab === 'gateway-keys'
      ? ['console-gateway-keys', activeGatewayId]
      : null,
    () => fetcher<{ keys: GatewayKeyRow[] }>(`/api/gateways/${activeGatewayId}/keys`),
  )
  const { data: secretsData, mutate: mutateSecrets } = useSWR(
    showSecrets || showProductOverview ? ['console-secrets', projectId] : null,
    () => fetcher<{ secrets: SecretRow[] }>(`/api/secrets${projectQuery}`),
  )
  const { data: opsSecretsData, mutate: mutateOpsSecrets } = useSWR(
    showSecrets ? 'console-ops-secrets' : null,
    () => fetcher<{ secrets: OpsSecretRow[]; note?: string }>('/api/ops/secrets'),
  )
  const { data: lbsData, mutate: mutateLbs } = useSWR(
    showLoadBalancers || showProductOverview ? ['console-lbs', projectId] : null,
    () => fetcher<{ loadBalancers: LoadBalancerRow[] }>(`/api/load-balancers${projectQuery}`),
  )
  const { data: dbsData, mutate: mutateDbs } = useSWR(
    showSqlInstances || showSqlBackups || showProductOverview ? ['console-dbs', projectId] : null,
    () => fetcher<{ instances: DatabaseInstanceRow[] }>(`/api/databases${projectQuery}`),
  )

  const deployments = depData?.deployments ?? []
  const gateways = gatewaysData?.gateways ?? []
  const runningDeployments = deployments.filter((d) => d.status === 'running')

  const { data: sqlBackupsData, mutate: mutateSqlBackups } = useSWR(
    showSqlBackups ? ['console-sql-backups', projectId, dbsData?.instances?.length] : null,
    async () => {
      const instances = dbsData?.instances ?? []
      const rows: { instanceName: string; instanceId: string; id: string; status: string; sizeBytes: number; createdAt?: string; trigger: string }[] = []
      for (const inst of instances) {
        const res = await fetcher<{ backups: { id: string; status: string; sizeBytes: number; createdAt?: string; trigger: string }[] }>(
          `/api/databases/${inst.id}/backups`,
        )
        for (const b of res.backups) {
          rows.push({ ...b, instanceName: inst.name, instanceId: inst.id })
        }
      }
      return rows
    },
  )

  const refreshConsoleData = useCallback(() => {
    void mutateDeps()
    void mutateProjects()
    void mutateKeys()
    void mutateBuckets()
    void mutateGateways()
    void mutateLbs()
    void mutateDbs()
    void mutateSecrets()
    void mutateMonitoring()
    void mutateBilling()
    void mutateInvoices()
    void mutateVms()
    void mutateSqlBackups()
  }, [
    mutateDeps, mutateProjects, mutateKeys, mutateBuckets, mutateGateways,
    mutateLbs, mutateDbs, mutateSecrets, mutateMonitoring, mutateBilling,
    mutateInvoices, mutateVms, mutateSqlBackups,
  ])

  const consoleStats = useMemo(() => ({
    deployments: deployments.length,
    running: runningDeployments.length,
    failed: deployments.filter((d) => d.status === 'failed').length,
    gateways: gateways.length,
    buckets: bucketsData?.buckets?.length ?? 0,
    databases: dbsData?.instances?.length ?? 0,
    loadBalancers: lbsData?.loadBalancers?.length ?? 0,
    secrets: secretsData?.secrets?.length ?? 0,
    apiHealthy,
  }), [deployments, runningDeployments, gateways, bucketsData, dbsData, lbsData, secretsData, apiHealthy])

  useEffect(() => {
    if (!selectedGatewayId && gateways.length) {
      setSelectedGatewayId(gateways[0].id)
    }
  }, [gateways, selectedGatewayId])

  useEffect(() => {
    if (tab !== 'gateway-deploy' || !activeGatewayId) {
      setDeployConfig('')
      return
    }
    fetcher<{ config: string }>(`/api/gateways/${activeGatewayId}/deploy`)
      .then((res) => setDeployConfig(res.config || ''))
      .catch(() => setDeployConfig(''))
  }, [tab, activeGatewayId, fetcher, gatewayRoutesData])

  const activeProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? projects[0],
    [projects, projectId],
  )

  const handleDeploy = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const q = projectId ? `?projectId=${projectId}` : ''
      await apiSend(`/api/deployments${q}`, 'POST', deployForm)
      setDeployForm({ name: '', image: '', port: 8080, minInstances: 0, maxInstances: 3 })
      await mutateDeps()
      await mutateMonitoring()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deploy failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await apiSend<{ project: Project }>('/api/projects', 'POST', { name: projectName })
      setProjectName('')
      await mutateProjects()
      if (res?.project?.id) setProjectId(res.project.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create project failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateKey = async () => {
    setBusy(true)
    setError('')
    setNewKey(null)
    try {
      const res = await apiSend<{ key: string }>('/api/api-keys', 'POST', { name: 'Dashboard key', scopes: ['deploy', 'read'] })
      setNewKey(res?.key ?? null)
      await mutateKeys()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create key failed')
    } finally {
      setBusy(false)
    }
  }

  const handleRevokeKey = async (id: string) => {
    setBusy(true)
    try {
      await apiSend(`/api/api-keys/${id}`, 'DELETE')
      await mutateKeys()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Revoke failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateBucket = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiSend('/api/buckets', 'POST', { name: bucketName, projectId: projectId || undefined })
      setBucketName('')
      await mutateBuckets()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create bucket failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateInvoice = async () => {
    setBusy(true)
    setError('')
    setLastPaymentLink(null)
    try {
      const res = await apiSend<{ invoice: Invoice; payment: { paymentLinkUrl?: string; status?: string; message?: string } }>(
        '/api/billing/invoices',
        'POST',
      )
      if (res?.payment?.paymentLinkUrl) {
        setLastPaymentLink(res.payment.paymentLinkUrl)
      } else if (res?.payment?.message) {
        setError(res.payment.message)
      }
      await mutateInvoices()
      await mutateBilling()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invoice failed')
    } finally {
      setBusy(false)
    }
  }

  const handleSyncInvoice = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      await apiSend(`/api/billing/invoices/${id}/sync`, 'POST')
      await mutateInvoices()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateVm = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiSend('/api/vms', 'POST', { ...vmForm, projectId: projectId || undefined })
      setVmForm({ name: '', cpu: 1, memoryMb: 512 })
      await mutateVms()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create VM failed')
    } finally {
      setBusy(false)
    }
  }

  const handleVmAction = async (id: string, action: 'start' | 'stop') => {
    setBusy(true)
    try {
      await apiSend(`/api/vms/${id}/${action}`, 'POST')
      await mutateVms()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'VM action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateSecret = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiSend('/api/secrets', 'POST', { ...secretForm, projectId: projectId || undefined })
      setSecretForm({ name: '', value: '' })
      await mutateSecrets()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create secret failed')
    } finally {
      setBusy(false)
    }
  }

  const handleRevealSecret = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetcher<{ secret: SecretRow }>(`/api/secrets/${id}?reveal=true`)
      setRevealedSecret({ id, value: res.secret.value || '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reveal secret failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSecret = async (id: string) => {
    setBusy(true)
    try {
      await apiSend(`/api/secrets/${id}`, 'DELETE')
      if (revealedSecret?.id === id) setRevealedSecret(null)
      await mutateSecrets()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete secret failed')
    } finally {
      setBusy(false)
    }
  }

  const handleMigrateOpsSecrets = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await apiSend<{ migrated: string[]; skipped: string[] }>('/api/ops/secrets/migrate', 'POST')
      await mutateOpsSecrets()
      setError('')
      alert(`Migrated: ${(res?.migrated ?? []).join(', ') || 'none'}\nSkipped: ${(res?.skipped ?? []).join(', ') || 'none'}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ops secret migration failed (admin only)')
    } finally {
      setBusy(false)
    }
  }

  const handleRevealOpsSecret = async (name: string) => {
    if (name === 'DATABASE_URL' || name === 'SECRETS_MASTER_KEY') {
      setError('Bootstrap secrets stay in env and cannot be revealed from the vault')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetcher<{ secret: OpsSecretRow }>(`/api/ops/secrets/${name}?reveal=true`)
      setRevealedOpsSecret({ name, value: res.secret.value || '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reveal ops secret failed (admin only)')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateLb = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiSend('/api/load-balancers', 'POST', {
        name: lbForm.name,
        protocol: lbForm.protocol,
        port: lbForm.port,
        targetDeploymentId: lbForm.targetDeploymentId || undefined,
        projectId: projectId || undefined,
      })
      setLbForm({ name: '', protocol: 'HTTP', port: 80, targetDeploymentId: '' })
      await mutateLbs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create load balancer failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteLb = async (id: string) => {
    setBusy(true)
    try {
      await apiSend(`/api/load-balancers/${id}`, 'DELETE')
      await mutateLbs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete load balancer failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateDb = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiSend('/api/databases', 'POST', { ...dbForm, projectId: projectId || undefined })
      setDbForm({ name: '', engine: 'postgres', version: '16', sizeGb: 10, dedicated: false })
      await mutateDbs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create database failed')
    } finally {
      setBusy(false)
    }
  }

  const handleRevealDb = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetcher<{ instance: DatabaseInstanceRow }>(`/api/databases/${id}?reveal=true`)
      setRevealedDb({ id, connectionString: res.instance.connectionString || '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reveal connection failed')
    } finally {
      setBusy(false)
    }
  }

  const handleBackupDb = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      await apiSend(`/api/databases/${id}/backups`, 'POST')
      await mutateDbs()
      await mutateSqlBackups()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Backup failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteDb = async (id: string) => {
    setBusy(true)
    try {
      await apiSend(`/api/databases/${id}`, 'DELETE')
      if (revealedDb?.id === id) setRevealedDb(null)
      await mutateDbs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete database failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteDeployment = async (id: string) => {
    setBusy(true)
    try {
      await apiSend(`/api/deployments/${id}`, 'DELETE')
      await mutateDeps()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateGateway = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await apiSend<{ gateway: GatewayRow }>('/api/gateways', 'POST', {
        name: gatewayName,
        projectId: projectId || undefined,
      })
      setGatewayName('')
      await mutateGateways()
      if (res?.gateway?.id) setSelectedGatewayId(res.gateway.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create gateway failed')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleGateway = async (id: string, status: string) => {
    setBusy(true)
    setError('')
    try {
      await apiSend(`/api/gateways/${id}`, 'PATCH', { status: status === 'active' ? 'disabled' : 'active' })
      await mutateGateways()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update gateway failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteGateway = async (id: string) => {
    setBusy(true)
    try {
      await apiSend(`/api/gateways/${id}`, 'DELETE')
      if (selectedGatewayId === id) setSelectedGatewayId('')
      await mutateGateways()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete gateway failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateRoute = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeGatewayId) return
    setBusy(true)
    setError('')
    try {
      await apiSend(`/api/gateways/${activeGatewayId}/routes`, 'POST', routeForm)
      setRouteForm({ method: 'GET', path: '/v1/', targetDeploymentId: '', stage: 'prod' })
      await mutateGatewayRoutes()
      await mutateGateways()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create route failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteRoute = async (routeId: string) => {
    if (!activeGatewayId) return
    setBusy(true)
    try {
      await apiSend(`/api/gateways/${activeGatewayId}/routes/${routeId}`, 'DELETE')
      await mutateGatewayRoutes()
      await mutateGateways()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete route failed')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateGatewayKey = async () => {
    if (!activeGatewayId) return
    setBusy(true)
    setError('')
    setNewGatewayKey(null)
    try {
      const res = await apiSend<{ key: string }>(`/api/gateways/${activeGatewayId}/keys`, 'POST', { name: 'Consumer key' })
      setNewGatewayKey(res?.key ?? null)
      await mutateGatewayKeys()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create key failed')
    } finally {
      setBusy(false)
    }
  }

  const handleRevokeGatewayKey = async (keyId: string) => {
    if (!activeGatewayId) return
    setBusy(true)
    try {
      await apiSend(`/api/gateways/${activeGatewayId}/keys/${keyId}`, 'DELETE')
      await mutateGatewayKeys()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Revoke failed')
    } finally {
      setBusy(false)
    }
  }

  const openFromHub = (id: ServiceId) => {
    pushRecentService(id)
    const target = id === 'db-cloud-sql' ? 'sql-get-started' : id
    router.push(`/dashboard/console?tab=${target}`)
  }

  const openService = (id: ServiceId) => {
    if (id === 'hub-home' || id === 'hub') {
      router.push('/dashboard/console')
      return
    }
    pushRecentService(id)
    setTab(id === 'db-cloud-sql' ? 'sql-get-started' : id)
    setError('')
    setNavOpen(false)
    router.push(`/dashboard/console?tab=${id === 'db-cloud-sql' ? 'sql-get-started' : id}`)
  }

  const topBar = (
    <ConsoleTopBar
      ref={topbarRef}
      showMenu={!isHubView}
      navOpen={navOpen}
      onMenuToggle={() => setNavOpen((v) => !v)}
      projectId={projectId}
      projects={projects}
      onProjectChange={setProjectId}
      onDataChange={refreshConsoleData}
      actions={!isHubView ? (
        <button
          type="button"
          className="gcp-btn-secondary gcp-btn-compact"
          onClick={() => router.push('/dashboard/console')}
        >
          Console home
        </button>
      ) : undefined}
    />
  )

  if (isHubView) {
    return (
      <div className="gcp-shell cl-console-shell cl-gc-app cl-gc-app--hub">
        {topBar}
        <div ref={mainRef} className="cl-gc-main">
          <section className="gcp-console cl-hub-shell">
            <ConsoleHub
              failedDeployments={monitoring?.deployments.failed ?? deployments.filter((d) => d.status === 'failed').length}
              apiHealthy={apiHealthy}
              onOpenService={openFromHub}
            />
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className={`gcp-shell cl-console-shell cl-gc-app${navOpen ? ' is-nav-open' : ''}`}>
      {!isHubView && navOpen && (
        <button type="button" className="cl-gc-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
      )}

      {topBar}

      {!isHubView && (
        <ConsoleNav active={tab} onSelect={openService} open={navOpen} onClose={() => setNavOpen(false)} />
      )}

      <div ref={mainRef} className="cl-gc-main">
      <section className="gcp-console">
        <div className="gcp-console-inner">
          <div className="gcp-console-head">
            <div>
              <p className="gcp-kicker">Console</p>
              <h2>{SERVICE_LABELS[tab]}</h2>
              {activeProject && !showIamProjects && !showApiKeys && tab !== 'agent-overview' && !showGateway && (
                <p className="cl-console-sub">{activeProject.name}</p>
              )}
            </div>
          </div>

          {error && <div className="gcp-form-error">{error}</div>}

          {(showDeployments) && (
            <>
              <form className="cl-console-inline-form" onSubmit={handleDeploy}>
                <input required placeholder="Service name" value={deployForm.name} onChange={(e) => setDeployForm({ ...deployForm, name: e.target.value })} />
                <input required placeholder="Image" value={deployForm.image} onChange={(e) => setDeployForm({ ...deployForm, image: e.target.value })} />
                <input type="number" required value={deployForm.port} onChange={(e) => setDeployForm({ ...deployForm, port: parseInt(e.target.value, 10) || 8080 })} />
                <input
                  type="number"
                  min={0}
                  max={100}
                  title="minInstances (0 = scale-to-zero)"
                  value={deployForm.minInstances}
                  onChange={(e) => setDeployForm({ ...deployForm, minInstances: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  title="maxInstances"
                  value={deployForm.maxInstances}
                  onChange={(e) => setDeployForm({ ...deployForm, maxInstances: Math.max(1, parseInt(e.target.value, 10) || 3) })}
                />
                <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy}>Deploy</button>
              </form>
              <p className="gcp-muted">
                min/max instances — default 0→3. KEDA ScaledObject on cluster when enabled; HTTP add-on for wake-from-zero (see docs/KEDA.md).
                Open <strong>Cloudlane Terminal</strong> to run <code>deploy create --name api --image nginx:alpine --port 80</code>.
              </p>
              <div className="cl-resource-grid">
                {deployments.length === 0 && (
                  <div className="cl-resource-card cl-resource-card--empty">No deployments yet — deploy above or use the terminal.</div>
                )}
                {deployments.map((d) => (
                  <article key={d.id} className="cl-resource-card">
                    <header className="cl-resource-card-head">
                      <span className="gcp-service">{d.name}</span>
                      <span className={`gcp-status gcp-status-${d.status}`}>{d.status}</span>
                    </header>
                    <dl className="cl-resource-meta">
                      <div><dt>Image</dt><dd>{d.image}</dd></div>
                      <div><dt>Port</dt><dd>{d.port}</dd></div>
                      <div><dt>URL</dt><dd>{d.publicUrl ? <a className="gcp-link" href={d.publicUrl} target="_blank" rel="noreferrer">{d.publicUrl.replace('https://', '')}</a> : '—'}</dd></div>
                      {d.statusMessage && <div className="cl-resource-full"><dt>Status</dt><dd>{d.statusMessage}</dd></div>}
                    </dl>
                    <footer className="cl-resource-actions">
                      <button type="button" className="cl-console-row-action" onClick={() => handleDeleteDeployment(d.id)} disabled={busy}>Stop</button>
                    </footer>
                  </article>
                ))}
              </div>
            </>
          )}

          {showIamProjects && (
            <>
              <form className="cl-console-inline-form" onSubmit={handleCreateProject}>
                <input required placeholder="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy}>Create project</button>
              </form>
              <div className="gcp-table">
                <div className="gcp-table-row gcp-table-head cl-table-2">
                  <span>Name</span><span>Slug</span>
                </div>
                {projects.map((p) => (
                  <div key={p.id} className="gcp-table-row cl-table-2">
                    <span className="gcp-service">{p.name}</span>
                    <span className="gcp-muted">{p.slug}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {showApiKeys && (
            <>
              <div className="cl-console-actions">
                <button type="button" className="gcp-btn-primary gcp-btn-compact" onClick={handleCreateKey} disabled={busy}>
                  {tab === 'agent' ? 'Get Agent Platform API key' : 'Create API key'}
                </button>
              </div>
              {newKey && (
                <div className="cl-key-reveal">
                  <p>Copy this key now — it won&apos;t be shown again.</p>
                  <code>{newKey}</code>
                </div>
              )}
              <div className="gcp-table">
                <div className="gcp-table-row gcp-table-head cl-table-3">
                  <span>Name</span><span>Prefix</span><span>Scopes</span>
                </div>
                {(keysData?.apiKeys ?? []).map((k) => (
                  <div key={k.id} className="gcp-table-row cl-table-3">
                    <span className="gcp-service">{k.name}</span>
                    <span className="gcp-muted">{k.prefix}…</span>
                    <span>{k.scopes.join(', ')}</span>
                    <button type="button" className="cl-console-row-action" onClick={() => handleRevokeKey(k.id)} disabled={busy}>Revoke</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {showProductOverview && (
            <ServiceProductOverview
              tab={tab}
              stats={consoleStats}
              onNavigate={openService}
              variant={isProductStubTab(tab) ? 'stub' : 'overview'}
            />
          )}

          {showGateway && (
            <>
              {gateways.length > 0 && (
                <div className="cl-console-actions">
                  <label className="gcp-muted">
                    Gateway{' '}
                    <select value={activeGatewayId} onChange={(e) => setSelectedGatewayId(e.target.value)}>
                      {gateways.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {tab === 'gateway' && (
                <>
                  <form className="cl-console-inline-form" onSubmit={handleCreateGateway}>
                    <input required placeholder="Gateway name" value={gatewayName} onChange={(e) => setGatewayName(e.target.value)} />
                    <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy}>Create gateway</button>
                  </form>
                  <p className="gcp-muted">
                    Edge API gateway with consumer keys and nginx config generation. Terminal:{' '}
                    <code>gateway create --name public-api</code>
                  </p>
                  <div className="cl-resource-grid">
                    {gateways.length === 0 && (
                      <div className="cl-resource-card cl-resource-card--empty">No gateways yet — create one to front your deployments.</div>
                    )}
                    {gateways.map((g) => (
                      <article key={g.id} className="cl-resource-card">
                        <header className="cl-resource-card-head">
                          <span className="gcp-service">{g.name}</span>
                          <span className={`gcp-status gcp-status-${g.status}`}>{g.status}</span>
                        </header>
                        <dl className="cl-resource-meta">
                          <div><dt>Hostname</dt><dd>{g.hostnames[0] ?? '—'}</dd></div>
                          <div><dt>Routes</dt><dd>{g.routeCount ?? 0}</dd></div>
                        </dl>
                        <footer className="cl-resource-actions">
                          <button type="button" className="cl-console-row-action" onClick={() => handleToggleGateway(g.id, g.status)} disabled={busy}>
                            {g.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                          <button type="button" className="cl-console-row-action" onClick={() => handleDeleteGateway(g.id)} disabled={busy}>Delete</button>
                        </footer>
                      </article>
                    ))}
                  </div>
                </>
              )}

              {tab === 'gateway-routes' && (
                <>
                  {!activeGatewayId ? (
                    <div className="cl-gc-stub"><p>Create a gateway first, then add routes to running deployments.</p></div>
                  ) : (
                    <>
                      <form className="cl-console-inline-form" onSubmit={handleCreateRoute}>
                        <select value={routeForm.method} onChange={(e) => setRouteForm({ ...routeForm, method: e.target.value })}>
                          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <input required placeholder="/v1/users" value={routeForm.path} onChange={(e) => setRouteForm({ ...routeForm, path: e.target.value })} />
                        <select required value={routeForm.targetDeploymentId} onChange={(e) => setRouteForm({ ...routeForm, targetDeploymentId: e.target.value })}>
                          <option value="">Target deployment</option>
                          {runningDeployments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <select value={routeForm.stage} onChange={(e) => setRouteForm({ ...routeForm, stage: e.target.value })}>
                          <option value="prod">prod</option>
                          <option value="dev">dev</option>
                        </select>
                        <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy || !runningDeployments.length}>Add route</button>
                      </form>
                      <div className="gcp-table">
                        <div className="gcp-table-row gcp-table-head cl-table-4">
                          <span>Method</span><span>Path</span><span>Stage</span><span>Target</span>
                        </div>
                        {(gatewayRoutesData?.routes ?? []).map((r) => (
                          <div key={r.id} className="gcp-table-row cl-table-4">
                            <span className="gcp-service">{r.method}</span>
                            <span>{r.path}</span>
                            <span className="gcp-muted">{r.stage}</span>
                            <span className="gcp-muted">{runningDeployments.find((d) => d.id === r.targetDeploymentId)?.name ?? r.targetDeploymentId}</span>
                            <button type="button" className="cl-console-row-action" onClick={() => handleDeleteRoute(r.id)} disabled={busy}>Delete</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {tab === 'gateway-keys' && (
                <>
                  {!activeGatewayId ? (
                    <div className="cl-gc-stub"><p>Create a gateway first, then issue consumer keys.</p></div>
                  ) : (
                    <>
                      <div className="cl-console-actions">
                        <button type="button" className="gcp-btn-primary gcp-btn-compact" onClick={handleCreateGatewayKey} disabled={busy}>Issue consumer key</button>
                      </div>
                      {newGatewayKey && (
                        <div className="cl-key-reveal">
                          <p>Copy this key now — it won&apos;t be shown again.</p>
                          <code>{newGatewayKey}</code>
                        </div>
                      )}
                      <div className="gcp-table">
                        <div className="gcp-table-row gcp-table-head cl-table-4">
                          <span>Name</span><span>Prefix</span><span>Rate limit</span><span>Last used</span>
                        </div>
                        {(gatewayKeysData?.keys ?? []).map((k) => (
                          <div key={k.id} className="gcp-table-row cl-table-4">
                            <span className="gcp-service">{k.name}</span>
                            <span className="gcp-muted">{k.prefix}…</span>
                            <span>{k.rateLimitRpm} rpm</span>
                            <span className="gcp-muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}</span>
                            <button type="button" className="cl-console-row-action" onClick={() => handleRevokeGatewayKey(k.id)} disabled={busy}>Revoke</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {tab === 'gateway-deploy' && (
                <>
                  {!activeGatewayId ? (
                    <div className="cl-gc-stub"><p>Create a gateway to preview edge config.</p></div>
                  ) : (
                    <>
                      <div className="cl-console-actions">
                        <button
                          type="button"
                          className="gcp-btn-secondary gcp-btn-compact"
                          onClick={() => navigator.clipboard.writeText(deployConfig)}
                          disabled={!deployConfig}
                        >
                          Copy config
                        </button>
                      </div>
                      <pre className="cl-gateway-config">{deployConfig || 'No routes configured yet.'}</pre>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'storage' && (
            <>
              <form className="cl-console-inline-form" onSubmit={handleCreateBucket}>
                <input required placeholder="Bucket name" value={bucketName} onChange={(e) => setBucketName(e.target.value)} />
                <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy}>Create bucket</button>
              </form>
              <p className="gcp-muted">MinIO-backed S3-compatible storage. Terminal: <code>bucket list</code> · <code>bucket create --name uploads</code></p>
              <div className="cl-resource-grid">
                {(bucketsData?.buckets ?? []).length === 0 && (
                  <div className="cl-resource-card cl-resource-card--empty">No buckets yet.</div>
                )}
                {(bucketsData?.buckets ?? []).map((b) => (
                  <article key={b.id} className="cl-resource-card">
                    <header className="cl-resource-card-head">
                      <span className="gcp-service">{b.name}</span>
                    </header>
                    <dl className="cl-resource-meta">
                      <div><dt>Project</dt><dd className="gcp-muted">{b.projectId ?? 'default'}</dd></div>
                    </dl>
                    <footer className="cl-resource-actions">
                      <button
                        type="button"
                        className="cl-console-row-action"
                        onClick={async () => {
                          setSelectedBucket(b.name)
                          try {
                            const res = await fetcher<{ objects: string[] }>(`/api/buckets/${b.name}/objects`)
                            setBucketObjects(res.objects)
                          } catch {
                            setBucketObjects([])
                          }
                        }}
                      >
                        Browse objects
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
              {selectedBucket && (
                <div className="cl-storage-objects">
                  <h4>Objects in <code>{selectedBucket}</code></h4>
                  {bucketObjects.length === 0 ? (
                    <p className="gcp-muted">No objects or bucket not reachable.</p>
                  ) : (
                    <ul>{bucketObjects.map((o) => <li key={o}><code>{o}</code></li>)}</ul>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'billing' && (
            <>
              <div className="cl-billing-cards">
                <article>
                  <p className="gcp-kicker">Compute</p>
                  <p className="cl-billing-stat">{billingUsage?.usage.computeSeconds ?? 0}s</p>
                </article>
                <article>
                  <p className="gcp-kicker">Estimated</p>
                  <p className="cl-billing-stat">{billingUsage?.usage.estimatedCost ?? 0} {billingUsage?.usage.currency ?? 'RWF'}</p>
                </article>
              </div>
              <div className="cl-console-actions">
                <button type="button" className="gcp-btn-primary gcp-btn-compact" onClick={handleCreateInvoice} disabled={busy}>Generate invoice</button>
              </div>
              {lastPaymentLink && (
                <p className="gcp-muted">
                  Pay via IremboPay:{' '}
                  <a href={lastPaymentLink} target="_blank" rel="noreferrer">{lastPaymentLink}</a>
                </p>
              )}
              <p className="gcp-muted">Configure IREMBOPAY_* in API env — see docs/IREMBOPAY.md. Webhook marks invoices paid.</p>
              <div className="gcp-table">
                <div className="gcp-table-row gcp-table-head cl-table-4">
                  <span>Amount</span><span>Status</span><span>IremboPay</span><span>Created</span>
                </div>
                {(invoicesData?.invoices ?? []).map((inv) => (
                  <div key={inv.id} className="gcp-table-row cl-table-4">
                    <span>{inv.totalAmount} {inv.currency}</span>
                    <span className={`gcp-status gcp-status-${inv.status}`}>{inv.status}</span>
                    <span className="gcp-muted">
                      {inv.irembopayPaymentLinkUrl ? (
                        <a href={inv.irembopayPaymentLinkUrl} target="_blank" rel="noreferrer">Pay</a>
                      ) : (inv.irembopayInvoiceNumber ?? '—')}
                      {inv.status === 'pending' && inv.irembopayInvoiceNumber && (
                        <button type="button" className="cl-console-row-action" onClick={() => handleSyncInvoice(inv.id)} disabled={busy}>Sync</button>
                      )}
                    </span>
                    <span className="gcp-muted">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {showMonitoring && monitoring && (
            <>
              <div className="cl-billing-cards">
                <article>
                  <p className="gcp-kicker">Deployments</p>
                  <p className="cl-billing-stat">{monitoring.deployments.running}/{monitoring.deployments.total} running</p>
                </article>
                <article>
                  <p className="gcp-kicker">Failed</p>
                  <p className="cl-billing-stat">{monitoring.deployments.failed}</p>
                </article>
              </div>
              <div className="cl-metrics-chart">
                {Object.entries(monitoring.metricsByType).map(([type, value]) => (
                  <div key={type} className="cl-metrics-bar">
                    <span>{type}</span>
                    <div><i style={{ width: `${Math.min(value / 10, 100)}%` }} /></div>
                    <b>{value}</b>
                  </div>
                ))}
                {!Object.keys(monitoring.metricsByType).length && (
                  <p className="gcp-muted">No usage metrics yet — deploy a service to start metering.</p>
                )}
              </div>
            </>
          )}

          {showComputeVms && (
            <>
              <form className="cl-console-inline-form" onSubmit={handleCreateVm}>
                <input required placeholder="VM name" value={vmForm.name} onChange={(e) => setVmForm({ ...vmForm, name: e.target.value })} />
                <input type="number" min={1} max={16} value={vmForm.cpu} onChange={(e) => setVmForm({ ...vmForm, cpu: parseInt(e.target.value, 10) || 1 })} />
                <input type="number" min={256} step={256} value={vmForm.memoryMb} onChange={(e) => setVmForm({ ...vmForm, memoryMb: parseInt(e.target.value, 10) || 512 })} />
                <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy}>Create VM</button>
              </form>
              <div className="gcp-table">
                <div className="gcp-table-row gcp-table-head cl-table-4">
                  <span>Name</span><span>CPU</span><span>Memory</span><span>Status</span>
                </div>
                {(vmsData?.vms ?? []).map((vm) => (
                  <div key={vm.id} className="gcp-table-row cl-table-4">
                    <span className="gcp-service">{vm.name}</span>
                    <span>{vm.cpu}</span>
                    <span>{vm.memoryMb} MB</span>
                    <span className={`gcp-status gcp-status-${vm.status}`}>{vm.status}</span>
                    <span className="gcp-muted">{vm.publicIp ?? '—'}</span>
                    {vm.status === 'running' ? (
                      <button type="button" className="cl-console-row-action" onClick={() => handleVmAction(vm.id, 'stop')} disabled={busy}>Stop</button>
                    ) : (
                      <button type="button" className="cl-console-row-action" onClick={() => handleVmAction(vm.id, 'start')} disabled={busy}>Start</button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {showSecrets && (
            <>
              <h3 style={{ marginTop: 0 }}>Tenant secrets</h3>
              <form className="cl-console-inline-form" onSubmit={handleCreateSecret}>
                <input required placeholder="Secret name" value={secretForm.name} onChange={(e) => setSecretForm({ ...secretForm, name: e.target.value })} />
                <input required type="password" placeholder="Secret value" value={secretForm.value} onChange={(e) => setSecretForm({ ...secretForm, value: e.target.value })} />
                <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy}>Store secret</button>
              </form>
              <p className="gcp-muted">Values are encrypted at rest (Fernet). Plaintext is only returned when you reveal.</p>
              <div className="gcp-table">
                <div className="gcp-table-row gcp-table-head cl-table-3">
                  <span>Name</span><span>Version</span><span>Value</span>
                </div>
                {(secretsData?.secrets ?? []).length === 0 && (
                  <div className="gcp-table-row cl-console-empty">No secrets yet.</div>
                )}
                {(secretsData?.secrets ?? []).map((s) => (
                  <div key={s.id} className="gcp-table-row cl-table-3">
                    <span className="gcp-service">{s.name}</span>
                    <span className="gcp-muted">v{s.version}</span>
                    <span className="gcp-muted">
                      {revealedSecret?.id === s.id ? revealedSecret.value : '••••••••'}
                    </span>
                    <button type="button" className="cl-console-row-action" onClick={() => handleRevealSecret(s.id)} disabled={busy}>Reveal</button>
                    <button type="button" className="cl-console-row-action" onClick={() => handleDeleteSecret(s.id)} disabled={busy}>Delete</button>
                  </div>
                ))}
              </div>

              <h3 style={{ marginTop: '2rem' }}>Control plane (Cloudlane secret migration)</h3>
              <p className="gcp-muted">
                {opsSecretsData?.note
                  || 'Migrate JWT / MinIO / Redis / IremboPay keys from .env into the encrypted ops vault. DATABASE_URL and SECRETS_MASTER_KEY stay in env.'}
              </p>
              <button type="button" className="gcp-btn-primary gcp-btn-compact" onClick={handleMigrateOpsSecrets} disabled={busy}>
                Migrate from .env
              </button>
              <div className="gcp-table" style={{ marginTop: '1rem' }}>
                <div className="gcp-table-row gcp-table-head cl-table-4">
                  <span>Name</span><span>Scope</span><span>Vault</span><span>Env</span>
                </div>
                {(opsSecretsData?.secrets ?? []).map((s) => (
                  <div key={s.name} className="gcp-table-row cl-table-4">
                    <span className="gcp-service">{s.name}</span>
                    <span className="gcp-muted">{s.scope}</span>
                    <span>{s.inVault ? `yes v${s.version ?? 1}` : 'no'}</span>
                    <span>{s.inEnv ? 'yes' : 'no'}</span>
                    {s.scope === 'ops' && (
                      <button type="button" className="cl-console-row-action" onClick={() => handleRevealOpsSecret(s.name)} disabled={busy}>
                        Reveal
                      </button>
                    )}
                    {revealedOpsSecret?.name === s.name && (
                      <span className="gcp-muted cl-console-status-msg">{revealedOpsSecret.value}</span>
                    )}
                  </div>
                ))}
                {!opsSecretsData?.secrets?.length && (
                  <div className="gcp-table-row cl-console-empty">Admin only — sign in as tenant admin to manage ops secrets.</div>
                )}
              </div>
            </>
          )}

          {showLoadBalancers && (
            <>
              <form className="cl-console-inline-form" onSubmit={handleCreateLb}>
                <input required placeholder="LB name" value={lbForm.name} onChange={(e) => setLbForm({ ...lbForm, name: e.target.value })} />
                <select value={lbForm.protocol} onChange={(e) => setLbForm({ ...lbForm, protocol: e.target.value })}>
                  <option value="HTTP">HTTP</option>
                  <option value="HTTPS">HTTPS</option>
                  <option value="TCP">TCP</option>
                </select>
                <input type="number" min={1} max={65535} value={lbForm.port} onChange={(e) => setLbForm({ ...lbForm, port: parseInt(e.target.value, 10) || 80 })} />
                <select value={lbForm.targetDeploymentId} onChange={(e) => setLbForm({ ...lbForm, targetDeploymentId: e.target.value })}>
                  <option value="">Target deployment (optional)</option>
                  {deployments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy}>Create LB</button>
              </form>
              <p className="gcp-muted">
                HTTP L7 on <code>:8080</code> (Host header). HTTPS TLS terminate on <code>:8443</code> (self-signed dev cert).
                TCP L4 on <code>:19400–19599</code>. Terminal: <code>lb create --name edge --protocol HTTP --port 80</code>
              </p>
              <div className="cl-resource-grid">
                {(lbsData?.loadBalancers ?? []).length === 0 && (
                  <div className="cl-resource-card cl-resource-card--empty">No load balancers yet.</div>
                )}
                {(lbsData?.loadBalancers ?? []).map((lb) => (
                  <article key={lb.id} className="cl-resource-card">
                    <header className="cl-resource-card-head">
                      <span className="gcp-service">{lb.name}</span>
                      <span className={`gcp-status gcp-status-${lb.status}`}>{lb.status}</span>
                    </header>
                    <dl className="cl-resource-meta">
                      <div><dt>Protocol</dt><dd>{lb.protocol}:{lb.port}</dd></div>
                      <div><dt>DNS</dt><dd>{lb.dnsName ?? '—'}</dd></div>
                      {lb.dnsName && (
                        <div className="cl-resource-full">
                          <dt>Test</dt>
                          <dd><code>curl -H &quot;Host: {lb.dnsName}&quot; http://localhost:8080/</code></dd>
                        </div>
                      )}
                    </dl>
                    <footer className="cl-resource-actions">
                      <button type="button" className="cl-console-row-action" onClick={() => handleDeleteLb(lb.id)} disabled={busy}>Delete</button>
                    </footer>
                  </article>
                ))}
              </div>
            </>
          )}

          {showSqlInstances && (
            <>
              <form className="cl-console-inline-form" onSubmit={handleCreateDb}>
                <input required placeholder="Instance name" value={dbForm.name} onChange={(e) => setDbForm({ ...dbForm, name: e.target.value })} />
                <select value={dbForm.engine} onChange={(e) => setDbForm({ ...dbForm, engine: e.target.value })}>
                  <option value="postgres">Postgres</option>
                  <option value="mysql">MySQL</option>
                </select>
                <input value={dbForm.version} onChange={(e) => setDbForm({ ...dbForm, version: e.target.value })} />
                <input type="number" min={5} max={1024} value={dbForm.sizeGb} onChange={(e) => setDbForm({ ...dbForm, sizeGb: parseInt(e.target.value, 10) || 10 })} />
                <label className="gcp-muted">
                  <input type="checkbox" checked={dbForm.dedicated} onChange={(e) => setDbForm({ ...dbForm, dedicated: e.target.checked })} />
                  {' '}Dedicated container (:19600–19699)
                </label>
                <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy}>Create instance</button>
              </form>
              <p className="gcp-muted">
                Shared Postgres (:5433) / MySQL (:3307) or dedicated Docker SQL. Automated daily backups to MinIO.
                Terminal: <code>db create --name app-db --dedicated</code>
              </p>
              <div className="cl-resource-grid">
                {(dbsData?.instances ?? []).length === 0 && (
                  <div className="cl-resource-card cl-resource-card--empty">No database instances yet.</div>
                )}
                {(dbsData?.instances ?? []).map((inst) => {
                  const diskPct = inst.diskUsedMb != null && inst.sizeGb > 0
                    ? Math.min(100, Math.round((inst.diskUsedMb / (inst.sizeGb * 1024)) * 100))
                    : 0
                  return (
                    <article key={inst.id} className="cl-resource-card">
                      <header className="cl-resource-card-head">
                        <span className="gcp-service">{inst.name}{inst.dedicated ? ' · dedicated' : ''}</span>
                        <span className={`gcp-status gcp-status-${inst.status}`}>{inst.status}</span>
                      </header>
                      <dl className="cl-resource-meta">
                        <div><dt>Engine</dt><dd>{inst.engine} {inst.version}</dd></div>
                        <div><dt>Endpoint</dt><dd>{inst.endpoint ?? 'provisioning…'}</dd></div>
                        <div className="cl-resource-full">
                          <dt>Disk</dt>
                          <dd>
                            {inst.diskUsedMb != null ? `${inst.diskUsedMb} MB / ${inst.sizeGb} GB` : `— / ${inst.sizeGb} GB`}
                            <div className="cl-quota-bar cl-quota-bar--inline">
                              <div className="cl-quota-bar-fill" style={{ width: `${diskPct}%` }} />
                            </div>
                          </dd>
                        </div>
                        {revealedDb?.id === inst.id && (
                          <div className="cl-resource-full">
                            <dt>Connection</dt>
                            <dd><code>{revealedDb.connectionString}</code></dd>
                          </div>
                        )}
                      </dl>
                      <footer className="cl-resource-actions">
                        <button type="button" className="cl-console-row-action" onClick={() => handleRevealDb(inst.id)} disabled={busy}>Reveal</button>
                        <button type="button" className="cl-console-row-action" onClick={() => handleBackupDb(inst.id)} disabled={busy}>Backup</button>
                        <button type="button" className="cl-console-row-action" onClick={() => handleDeleteDb(inst.id)} disabled={busy}>Delete</button>
                      </footer>
                    </article>
                  )
                })}
              </div>
            </>
          )}

          {tab === 'solutions-all' && (
            <div className="cl-gc-hub">
              {PRODUCT_IDS.map((id) => (
                <button type="button" key={id} className="cl-gc-hub-card" onClick={() => openService(id)}>
                  {SERVICE_LABELS[id]}
                </button>
              ))}
            </div>
          )}

          {showSecurity && (
            <div className="gcp-table">
              <div className="gcp-table-row gcp-table-head cl-table-3">
                <span>Action</span><span>Resource</span><span>When</span>
              </div>
              {(auditData?.auditLogs ?? []).length === 0 && (
                <div className="gcp-table-row cl-console-empty">No audit events yet.</div>
              )}
              {(auditData?.auditLogs ?? []).map((log) => (
                <div key={log.id} className="gcp-table-row cl-table-3">
                  <span className="gcp-service">{log.action}</span>
                  <span className="gcp-muted">{log.resourceType}</span>
                  <span className="gcp-muted">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'solutions' && (
            <div className="cl-gc-stub">
              <p>Blueprints for API backends, staging previews, and scale-to-zero workers. Click the arrow on Solutions to browse all products, deployments, and the App Design Center.</p>
            </div>
          )}

          {tab === 'solutions-app-design' && (
            <div className="cl-gc-stub">
              <p>Compose services, routes, and env vars visually before you deploy. Coming soon.</p>
            </div>
          )}

          {(tab === 'hub-quotas' || tab === 'iam-quotas') && quotaReport && (
            <div className="cl-quota-grid">
              {[
                {
                  label: 'Deployments',
                  used: quotaReport.usage.deployments,
                  limit: quotaReport.limits.maxDeployments,
                },
                {
                  label: 'CPU (vCPU at max scale)',
                  used: quotaReport.usage.totalCpu,
                  limit: quotaReport.limits.maxCpu,
                },
                {
                  label: 'Memory (MB at max scale)',
                  used: quotaReport.usage.totalMemoryMb,
                  limit: quotaReport.limits.maxMemoryMb,
                },
                {
                  label: 'Storage buckets',
                  used: quotaReport.usage.buckets,
                  limit: quotaReport.limits.maxBuckets,
                },
                {
                  label: 'Secrets',
                  used: quotaReport.usage.secrets ?? 0,
                  limit: quotaReport.limits.maxSecrets ?? 50,
                },
                {
                  label: 'Load balancers',
                  used: quotaReport.usage.loadBalancers ?? 0,
                  limit: quotaReport.limits.maxLoadBalancers ?? 5,
                },
                {
                  label: 'Database instances',
                  used: quotaReport.usage.databaseInstances ?? 0,
                  limit: quotaReport.limits.maxDatabaseInstances ?? 3,
                },
              ].map((row) => {
                const pct = row.limit > 0 ? Math.min(100, Math.round((row.used / row.limit) * 100)) : 0
                return (
                  <div key={row.label} className="cl-quota-card">
                    <div className="cl-quota-card-head">
                      <strong>{row.label}</strong>
                      <span className="gcp-muted">
                        {row.used} / {row.limit}
                      </span>
                    </div>
                    <div className="cl-quota-bar">
                      <div className="cl-quota-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              <p className="gcp-muted" style={{ marginTop: '1rem' }}>
                Per-deployment max instances: {quotaReport.limits.maxInstances}. Quotas apply at enqueue time for deploys and buckets.
              </p>
            </div>
          )}

          {(tab === 'hub-optimization' || tab === 'hub-maintenance' || tab === 'hub-support') && (
            <div className="cl-gc-stub">
              <p>{SERVICE_LABELS[tab]} is on the roadmap. Deploy and monitor services from the Cloud Hub menu today.</p>
            </div>
          )}

          {tab === 'marketplace' && (
            <div className="cl-gc-stub">
              <p>Third-party images and add-ons will land here. Deploy from Cloud Run in the meantime.</p>
            </div>
          )}

          {showSqlBackups && (
            <>
              <p className="gcp-muted">
                Automated daily backups to MinIO (<code>cloudlane-db-backups</code>). Manual backup from Instances or terminal:{' '}
                <code>db backup &lt;name&gt;</code>
              </p>
              <div className="gcp-table">
                <div className="gcp-table-row gcp-table-head cl-table-5">
                  <span>Instance</span><span>Backup ID</span><span>Status</span><span>Size</span><span>When</span>
                </div>
                {(sqlBackupsData ?? []).length === 0 && (
                  <div className="gcp-table-row cl-console-empty">No backups yet — create an instance and run Backup.</div>
                )}
                {(sqlBackupsData ?? []).map((b) => (
                  <div key={b.id} className="gcp-table-row cl-table-5">
                    <span className="gcp-service">{b.instanceName}</span>
                    <span className="gcp-muted">{b.id.slice(-8)}</span>
                    <span className={`gcp-status gcp-status-${b.status}`}>{b.status}</span>
                    <span>{Math.round((b.sizeBytes || 0) / 1024)} KB</span>
                    <span className="gcp-muted">{b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {showSqlGetStarted && (
            <div className="cl-gc-stub">
              <p>
                Cloud SQL instances provision real Postgres (:5433) / MySQL (:3307) databases.
                Open Instances to create one — connection strings are encrypted; Mongo stays the control plane.
              </p>
              <button type="button" className="gcp-btn-primary gcp-btn-compact" onClick={() => openService('sql-instances')}>
                Go to Instances
              </button>
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
  )
}
