'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { ServiceId } from './consoleNavMenus'

type HomeTab = 'dashboard' | 'activity' | 'recommendations'

interface Project {
  id: string
  name: string
  slug: string
}

interface HomeDashboardProps {
  project?: Project
  apiHealthy?: boolean | null
  onOpenService?: (id: ServiceId) => void
}

function CardMenu() {
  return (
    <button type="button" className="cl-home-card-menu" aria-label="Card options">
      ⋮
    </button>
  )
}

function CardLink({
  children,
  onClick,
  href,
}: {
  children: ReactNode
  onClick?: () => void
  href?: string
}) {
  if (href) {
    return (
      <a className="cl-home-card-link" href={href} target="_blank" rel="noreferrer">
        {children}
        <span className="cl-home-card-arrow" aria-hidden>→</span>
      </a>
    )
  }
  return (
    <button type="button" className="cl-home-card-link" onClick={onClick}>
      {children}
      <span className="cl-home-card-arrow" aria-hidden>→</span>
    </button>
  )
}

const RESOURCES: { id: ServiceId; label: string; desc: string }[] = [
  { id: 'bigquery', label: 'BigQuery', desc: 'Data warehouse/analytics' },
  { id: 'sql', label: 'SQL', desc: 'Managed MySQL, PostgreSQL, SQL Server' },
  { id: 'compute', label: 'Compute Engine', desc: 'VMs, GPUs, TPUs, Disks' },
  { id: 'storage', label: 'Storage', desc: 'Multi-class multi-region object storage' },
  { id: 'run', label: 'Cloud Run', desc: 'Fully managed application platform' },
]

const GETTING_STARTED: { label: string; id?: ServiceId }[] = [
  { label: 'Explore and enable APIs', id: 'apis' },
  { label: 'Deploy a prebuilt solution', id: 'marketplace' },
  { label: 'Add dynamic logging to a running application', id: 'mon-logs-explorer' },
  { label: 'Monitor errors with Error Reporting', id: 'mon-error-reporting' },
  { label: 'Deploy a Hello World app', id: 'run-services' },
  { label: 'Take a VM quickstart', id: 'compute-vm-instances' },
  { label: 'Create a Cloud Storage bucket', id: 'storage' },
  { label: 'Create a Cloud Run function', id: 'run-jobs' },
  { label: 'Install the Cloud SDK' },
]

const NEWS = [
  { title: "What's new with Cloudlane", ago: '4 days ago' },
  { title: 'Deploy intelligence and scale-to-zero billing', ago: '5 days ago' },
  { title: 'Per-tenant isolation on the control plane', ago: '7 days ago' },
]

const DOCS = [
  { label: 'Learn about Compute Engine', id: 'compute' as ServiceId },
  { label: 'Learn about Cloud Storage', id: 'storage' as ServiceId },
  { label: 'Learn about Cloud Run', id: 'run' as ServiceId },
]

function projectNumber(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return String(710000000000 + (hash % 999999999))
}

export default function HomeDashboard({ project, apiHealthy, onOpenService }: HomeDashboardProps) {
  const router = useRouter()
  const [tab, setTab] = useState<HomeTab>('dashboard')

  const open = (id: ServiceId) => {
    if (onOpenService) {
      onOpenService(id)
      return
    }
    router.push(`/dashboard/console?tab=${id}`)
  }

  return (
    <div className="cl-home" id="home-dashboard">
      <div className="cl-home-head">
        <h1>Home</h1>
        <nav className="cl-home-tabs" aria-label="Home views">
          {(['dashboard', 'activity', 'recommendations'] as HomeTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? 'is-active' : ''}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button type="button" className="cl-home-customize">
            <span aria-hidden>✎</span> Customize
          </button>
        </nav>
      </div>

      {tab === 'dashboard' && (
        <div className="cl-home-grid">
          <article className="cl-home-card">
            <header>
              <h2>Project info</h2>
              <CardMenu />
            </header>
            <dl className="cl-home-kv">
              <div><dt>Project name</dt><dd>{project?.name ?? '—'}</dd></div>
              <div><dt>Project number</dt><dd>{project ? projectNumber(project.id) : '—'}</dd></div>
              <div><dt>Project ID</dt><dd>{project?.slug ?? '—'}</dd></div>
            </dl>
            <CardLink onClick={() => open('iam-iam')}>Add people to this project</CardLink>
            <footer>
              <CardLink onClick={() => open('iam-manage-resources')}>Go to project settings</CardLink>
            </footer>
          </article>

          <article className="cl-home-card cl-home-card--wide">
            <header>
              <h2>APIs</h2>
              <CardMenu />
            </header>
            <p className="cl-home-chart-label">Requests (requests/sec)</p>
            <div className="cl-home-chart-empty">
              <span aria-hidden>⚠</span>
              <p>No data is available for the selected time frame.</p>
            </div>
            <footer>
              <CardLink onClick={() => open('apis')}>Go to APIs overview</CardLink>
            </footer>
          </article>

          <article className="cl-home-card cl-home-card--status">
            <header>
              <h2>Cloudlane status</h2>
              <CardMenu />
            </header>
            <p className="cl-home-status-text">
              {apiHealthy === false ? 'Some services degraded' : 'All services normal'}
            </p>
            <CardLink href="https://comfy-starlight-51c0e7.netlify.app/health" >
              Go to status dashboard
            </CardLink>
          </article>

          <article className="cl-home-card cl-home-card--tall">
            <header>
              <h2>Resources</h2>
              <CardMenu />
            </header>
            <ul className="cl-home-resource-list">
              {RESOURCES.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => open(r.id)}>
                    <strong>{r.label}</strong>
                    <span>{r.desc}</span>
                  </button>
                </li>
              ))}
            </ul>
          </article>

          <article className="cl-home-card">
            <header>
              <h2>Monitoring</h2>
              <CardMenu />
            </header>
            <ul className="cl-home-link-list">
              <li><button type="button" onClick={() => open('mon-dashboards')}>Create my dashboard</button></li>
              <li><button type="button" onClick={() => open('mon-alerting')}>Set up alerting policies</button></li>
              <li><button type="button" onClick={() => open('mon-uptime-checks')}>Create uptime checks</button></li>
            </ul>
            <footer>
              <button type="button" className="cl-home-text-link" onClick={() => open('monitoring')}>
                View all dashboards
              </button>
            </footer>
          </article>

          <article className="cl-home-card">
            <header>
              <h2>Error Reporting</h2>
              <CardMenu />
            </header>
            <p className="cl-home-muted">No sign of any errors. Have you set up Error Reporting?</p>
            <CardLink onClick={() => open('mon-error-reporting')}>Learn how to set up Error Reporting</CardLink>
          </article>

          <article className="cl-home-card cl-home-card--tall">
            <header>
              <h2>Getting Started</h2>
              <CardMenu />
            </header>
            <ul className="cl-home-link-list">
              {GETTING_STARTED.map((item) => (
                <li key={item.label}>
                  {item.id ? (
                    <button type="button" onClick={() => open(item.id!)}>{item.label}</button>
                  ) : (
                    <span className="cl-home-muted-row">{item.label}</span>
                  )}
                </li>
              ))}
            </ul>
            <footer>
              <CardLink onClick={() => open('solutions-all')}>Explore all tutorials</CardLink>
            </footer>
          </article>

          <article className="cl-home-card">
            <header>
              <h2>News</h2>
              <CardMenu />
            </header>
            <ul className="cl-home-news">
              {NEWS.map((n) => (
                <li key={n.title}>
                  <strong>{n.title}</strong>
                  <span>{n.ago}</span>
                </li>
              ))}
            </ul>
            <footer className="cl-home-card-footer-split">
              <button type="button" className="cl-home-text-link">Read all news</button>
              <button type="button" className="cl-home-text-link">Read all release notes</button>
            </footer>
          </article>

          <article className="cl-home-card">
            <header>
              <h2>Documentation</h2>
              <CardMenu />
            </header>
            <ul className="cl-home-link-list">
              {DOCS.map((d) => (
                <li key={d.label}>
                  <button type="button" onClick={() => open(d.id)}>{d.label}</button>
                </li>
              ))}
            </ul>
          </article>
        </div>
      )}

      {tab === 'activity' && (
        <div className="cl-home-stub-panel">
          <p>Recent project activity — deploys, IAM changes, and API calls will appear here.</p>
          <button type="button" className="gcp-btn-secondary gcp-btn-compact" onClick={() => open('iam-audit-logs')}>
            View audit logs
          </button>
        </div>
      )}

      {tab === 'recommendations' && (
        <div className="cl-home-stub-panel">
          <p>Optimization tips, security findings, and cost recommendations will surface here.</p>
          <button type="button" className="gcp-btn-secondary gcp-btn-compact" onClick={() => open('hub-optimization')}>
            View optimization hub
          </button>
        </div>
      )}
    </div>
  )
}
