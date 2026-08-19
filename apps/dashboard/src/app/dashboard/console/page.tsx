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
  IAM_PROJECT_TABS,
  isOverviewTab,
  isProductStubTab,
  K8S_DEPLOY_TABS,
  MONITORING_LIVE_TABS,
  RUN_DEPLOY_TABS,
  SECURITY_AUDIT_TABS,
  SQL_GET_STARTED_TABS,
  PRODUCT_IDS,
  SERVICE_LABELS,
  type ServiceId,
} from '../../../components/ConsoleNav'
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

interface Invoice {
  id: string
  totalAmount: number
  currency: string
  status: string
  createdAt?: string
}

interface MonitoringSummary {
  deployments: { total: number; running: number; failed: number }
  metricsByType: Record<string, number>
  recentMetrics: { metricType: string; value: number; windowStart: string }[]
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
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.error || 'Request failed')
  }
  return res.json()
}

async function apiSend<T = unknown>(path: string, method: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || data.error || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json() as Promise<T>
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
  const [deployForm, setDeployForm] = useState({ name: '', image: '', port: 8080 })
  const [projectName, setProjectName] = useState('')
  const [bucketName, setBucketName] = useState('')
  const [vmForm, setVmForm] = useState({ name: '', cpu: 1, memoryMb: 512 })
  const [gatewayName, setGatewayName] = useState('')
  const [selectedGatewayId, setSelectedGatewayId] = useState('')
  const [routeForm, setRouteForm] = useState({ method: 'GET', path: '/v1/', targetDeploymentId: '', stage: 'prod' })
  const [newGatewayKey, setNewGatewayKey] = useState<string | null>(null)
  const [deployConfig, setDeployConfig] = useState('')
  const [busy, setBusy] = useState(false)

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

  const { data: keysData, mutate: mutateKeys } = useSWR(
    showApiKeys ? 'console-keys' : null,
    () => fetcher<{ apiKeys: ApiKeyRow[] }>('/api/api-keys'),
  )
  const { data: bucketsData, mutate: mutateBuckets } = useSWR(
    tab === 'storage' ? ['console-buckets', projectId] : null,
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
  const { data: vmsData, mutate: mutateVms } = useSWR(
    showComputeVms ? ['console-vms', projectId] : null,
    () => fetcher<{ vms: Vm[] }>(`/api/vms${projectQuery}`),
  )
  const { data: auditData } = useSWR(
    showSecurity ? 'console-audit' : null,
    () => fetcher<{ auditLogs: AuditLog[] }>('/api/audit-logs'),
  )
  const { data: gatewaysData, mutate: mutateGateways } = useSWR(
    showGateway ? ['console-gateways', projectId] : null,
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

  const deployments = depData?.deployments ?? []
  const gateways = gatewaysData?.gateways ?? []
  const runningDeployments = deployments.filter((d) => d.status === 'running')

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
      setDeployForm({ name: '', image: '', port: 8080 })
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
    try {
      await apiSend('/api/billing/invoices', 'POST')
      await mutateInvoices()
      await mutateBilling()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invoice failed')
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
                <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={busy}>Deploy</button>
              </form>
              <div className="gcp-table">
                <div className="gcp-table-row gcp-table-head">
                  <span>Name</span><span>Image</span><span>URL</span><span>Status</span>
                </div>
                {deployments.length === 0 && (
                  <div className="gcp-table-row cl-console-empty">No deployments yet.</div>
                )}
                {deployments.map((d) => (
                  <div key={d.id} className="gcp-table-row">
                    <span className="gcp-service">{d.name}</span>
                    <span className="gcp-muted">{d.image}</span>
                    {d.publicUrl ? (
                      <a className="gcp-link" href={d.publicUrl} target="_blank" rel="noreferrer">{d.publicUrl.replace('https://', '')}</a>
                    ) : (
                      <span className="gcp-muted">—</span>
                    )}
                    <span className={`gcp-status gcp-status-${d.status}`}>{d.status}</span>
                    {d.statusMessage && (
                      <span className="gcp-muted cl-console-status-msg">{d.statusMessage}</span>
                    )}
                    <button type="button" className="cl-console-row-action" onClick={() => handleDeleteDeployment(d.id)} disabled={busy}>Stop</button>
                  </div>
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

          {isOverviewTab(tab) && (
            <div className="cl-gc-stub">
              <p>{SERVICE_LABELS[tab]} — pick a section from the chevron menu to get started.</p>
            </div>
          )}

          {isProductStubTab(tab) && (
            <div className="cl-gc-stub">
              <p>{SERVICE_LABELS[tab]} is coming soon on Cloudlane.</p>
            </div>
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
                  <div className="gcp-table">
                    <div className="gcp-table-row gcp-table-head cl-table-4">
                      <span>Name</span><span>Hostname</span><span>Routes</span><span>Status</span>
                    </div>
                    {gateways.length === 0 && (
                      <div className="gcp-table-row cl-console-empty">No gateways yet — create one to front your deployments.</div>
                    )}
                    {gateways.map((g) => (
                      <div key={g.id} className="gcp-table-row cl-table-4">
                        <span className="gcp-service">{g.name}</span>
                        <span className="gcp-muted">{g.hostnames[0] ?? '—'}</span>
                        <span>{g.routeCount ?? 0}</span>
                        <span className={`gcp-status gcp-status-${g.status}`}>{g.status}</span>
                        <button type="button" className="cl-console-row-action" onClick={() => handleToggleGateway(g.id, g.status)} disabled={busy}>
                          {g.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" className="cl-console-row-action" onClick={() => handleDeleteGateway(g.id)} disabled={busy}>Delete</button>
                      </div>
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
              <div className="gcp-table">
                <div className="gcp-table-row gcp-table-head cl-table-2">
                  <span>Name</span><span>Project</span>
                </div>
                {(bucketsData?.buckets ?? []).map((b) => (
                  <div key={b.id} className="gcp-table-row cl-table-2">
                    <span className="gcp-service">{b.name}</span>
                    <span className="gcp-muted">{b.projectId ?? '—'}</span>
                  </div>
                ))}
              </div>
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
              <div className="gcp-table">
                <div className="gcp-table-row gcp-table-head cl-table-3">
                  <span>Amount</span><span>Status</span><span>Created</span>
                </div>
                {(invoicesData?.invoices ?? []).map((inv) => (
                  <div key={inv.id} className="gcp-table-row cl-table-3">
                    <span>{inv.totalAmount} {inv.currency}</span>
                    <span className={`gcp-status gcp-status-${inv.status}`}>{inv.status}</span>
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

          {(tab === 'hub-optimization' || tab === 'hub-quotas' || tab === 'hub-maintenance' || tab === 'hub-support') && (
            <div className="cl-gc-stub">
              <p>{SERVICE_LABELS[tab]} is on the roadmap. Deploy and monitor services from the Cloud Hub menu today.</p>
            </div>
          )}

          {tab === 'marketplace' && (
            <div className="cl-gc-stub">
              <p>Third-party images and add-ons will land here. Deploy from Cloud Run in the meantime.</p>
            </div>
          )}

          {showSqlGetStarted && (
            <div className="cl-gc-stub">
              <p>Managed Postgres/MySQL isn&apos;t provisioned yet. Use Cloud Storage for object data today.</p>
            </div>
          )}
        </div>
      </section>
      </div>
    </div>
  )
}
