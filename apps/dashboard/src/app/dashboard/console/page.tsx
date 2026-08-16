'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import Logo from '../../../components/Logo'
import { getApiBase } from '../../../lib/api'

type Tab = 'deployments' | 'projects' | 'keys' | 'storage' | 'billing' | 'monitoring' | 'vms'

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
  const [tab, setTab] = useState<Tab>('deployments')
  const [projectId, setProjectId] = useState<string>('')
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [deployForm, setDeployForm] = useState({ name: '', image: '', port: 8080 })
  const [projectName, setProjectName] = useState('')
  const [bucketName, setBucketName] = useState('')
  const [vmForm, setVmForm] = useState({ name: '', cpu: 1, memoryMb: 512 })
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
  const { data: keysData, mutate: mutateKeys } = useSWR(
    tab === 'keys' ? 'console-keys' : null,
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
    tab === 'monitoring' ? 'console-monitoring' : null,
    () => fetcher<MonitoringSummary>('/api/monitoring/summary'),
  )
  const { data: vmsData, mutate: mutateVms } = useSWR(
    tab === 'vms' ? ['console-vms', projectId] : null,
    () => fetcher<{ vms: Vm[] }>(`/api/vms${projectQuery}`),
  )

  const deployments = depData?.deployments ?? []
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'deployments', label: 'Deployments' },
    { id: 'projects', label: 'Projects' },
    { id: 'keys', label: 'API keys' },
    { id: 'storage', label: 'Storage' },
    { id: 'billing', label: 'Billing' },
    { id: 'monitoring', label: 'Monitoring' },
    { id: 'vms', label: 'VMs' },
  ]

  return (
    <div className="gcp-shell cl-console-shell">
      <header className="cl-console-top">
        <a href="/dashboard" className="hero-sky-brand">
          <Logo size="sm" />
        </a>
        <div className="cl-console-project">
          <span>Project</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Active project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="gcp-btn-secondary gcp-btn-compact"
          onClick={() => { localStorage.removeItem('token'); router.push('/') }}
        >
          Sign out
        </button>
      </header>

      <nav className="cl-console-tabs" aria-label="Console sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => { setTab(t.id); setError('') }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="gcp-console">
        <div className="gcp-console-inner">
          <div className="gcp-console-head">
            <div>
              <p className="gcp-kicker">Console</p>
              <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
              {activeProject && tab !== 'projects' && tab !== 'keys' && (
                <p className="cl-console-sub">{activeProject.name}</p>
              )}
            </div>
          </div>

          {error && <div className="gcp-form-error">{error}</div>}

          {tab === 'deployments' && (
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
                    <button type="button" className="cl-console-row-action" onClick={() => handleDeleteDeployment(d.id)} disabled={busy}>Stop</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'projects' && (
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

          {tab === 'keys' && (
            <>
              <div className="cl-console-actions">
                <button type="button" className="gcp-btn-primary gcp-btn-compact" onClick={handleCreateKey} disabled={busy}>Create API key</button>
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

          {tab === 'monitoring' && monitoring && (
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

          {tab === 'vms' && (
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
        </div>
      </section>
    </div>
  )
}
