'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import ActivityMonitoringView from './ActivityMonitoringView'
import RecommendationsView from './RecommendationsView'
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
      </svg>
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
        <svg className="cl-home-card-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    )
  }
  return (
    <button type="button" className="cl-home-card-link" onClick={onClick}>
      {children}
      <svg className="cl-home-card-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/* ── Service icon map ─────────────────────────────────────── */
const SERVICE_META: Record<string, { icon: string; color: string; bg: string }> = {
  bigquery: { icon: '◈', color: '#1a6ef0', bg: 'hsl(214 90% 96%)' },
  sql:      { icon: '⬡', color: '#0b8043', bg: 'hsl(145 80% 94%)' },
  compute:  { icon: '⬢', color: '#c2410c', bg: 'hsl(20 90% 95%)'  },
  storage:  { icon: '◉', color: '#7c3aed', bg: 'hsl(262 80% 96%)' },
  run:      { icon: '▶', color: '#0369a1', bg: 'hsl(200 80% 95%)' },
}

const RESOURCES: { id: ServiceId; label: string; desc: string }[] = [
  { id: 'bigquery', label: 'BigQuery',       desc: 'Data warehouse & analytics'              },
  { id: 'sql',      label: 'Cloud SQL',       desc: 'Managed MySQL · PostgreSQL · MSSQL'     },
  { id: 'compute',  label: 'Compute Engine',  desc: 'VMs, GPUs, TPUs & persistent disks'     },
  { id: 'storage',  label: 'Cloud Storage',   desc: 'Multi-class multi-region object storage' },
  { id: 'run',      label: 'Cloud Run',       desc: 'Fully managed container platform'        },
]

const GETTING_STARTED: { label: string; id?: ServiceId; badge?: string }[] = [
  { label: 'Explore & enable APIs',                   id: 'apis',               badge: 'Popular' },
  { label: 'Deploy a prebuilt solution',              id: 'marketplace'                          },
  { label: 'Add dynamic logging to a running app',    id: 'mon-logs-explorer'                    },
  { label: 'Monitor errors with Error Reporting',     id: 'mon-error-reporting'                  },
  { label: 'Deploy a Hello World app',                id: 'run-services'                         },
  { label: 'Take a VM quickstart',                    id: 'compute-vm-instances'                 },
  { label: 'Create a Cloud Storage bucket',           id: 'storage'                              },
  { label: 'Create a Cloud Run function',             id: 'run-jobs'                             },
  { label: 'Install the Cloud SDK'                                                               },
]

const NEWS = [
  { title: "What's new with Cloudlane",                   ago: '4 days ago', dot: '#22c55e' },
  { title: 'Deploy intelligence & scale-to-zero billing', ago: '5 days ago', dot: '#3b82f6' },
  { title: 'Per-tenant isolation on the control plane',   ago: '7 days ago', dot: '#a855f7' },
]

const DOCS = [
  { label: 'Learn about Compute Engine', id: 'compute' as ServiceId, icon: '⬢' },
  { label: 'Learn about Cloud Storage',  id: 'storage' as ServiceId, icon: '◉' },
  { label: 'Learn about Cloud Run',      id: 'run'     as ServiceId, icon: '▶' },
]

const MONITORING_ACTIONS = [
  { label: 'Create my dashboard',      id: 'mon-dashboards'    as ServiceId, icon: '▦' },
  { label: 'Set up alerting policies', id: 'mon-alerting'      as ServiceId, icon: '◎' },
  { label: 'Create uptime checks',     id: 'mon-uptime-checks' as ServiceId, icon: '◌' },
]

const STATUS_SERVICES = ['Compute', 'Storage', 'Network', 'Databases']

function projectNumber(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return String(710000000000 + (hash % 999999999))
}

/* ── Spark bar chart ─────────────────────────────────────── */
function SparkChart() {
  const values = [12, 28, 18, 42, 35, 55, 38, 62, 48, 70, 58, 80]
  const max = Math.max(...values)
  const w = 8; const gap = 4; const h = 52
  return (
    <svg className="cl-home-spark" viewBox={`0 0 ${values.length * (w + gap) - gap} ${h}`} aria-hidden>
      {values.map((v, i) => {
        const bh = Math.max(4, (v / max) * h)
        return <rect key={i} x={i * (w + gap)} y={h - bh} width={w} height={bh} rx="2" />
      })}
    </svg>
  )
}

/* ── Status pulse dot ────────────────────────────────────── */
function PulseDot({ ok }: { ok: boolean }) {
  return (
    <span className={`cl-home-pulse${ok ? ' is-ok' : ' is-warn'}`} aria-hidden>
      <span className="cl-home-pulse-ring" />
    </span>
  )
}

export default function HomeDashboard({ project, apiHealthy, onOpenService }: HomeDashboardProps) {
  const router = useRouter()
  const [tab, setTab] = useState<HomeTab>('dashboard')

  const open = (id: ServiceId) => {
    if (onOpenService) { onOpenService(id); return }
    router.push(`/dashboard/console?tab=${id}`)
  }

  const isHealthy = apiHealthy !== false

  return (
    <div className="cl-home" id="home-dashboard">

      {/* ─── Header ─────────────────────────────────── */}
      <div className="cl-home-head">
        <div className="cl-home-head-top">
          <h1>
            <span className="cl-home-h1-mark" aria-hidden>⬡</span>
            Home
          </h1>
          {project && <span className="cl-home-proj-badge">{project.name}</span>}
        </div>
        <nav className="cl-home-tabs" aria-label="Home views">
          {(['dashboard', 'activity', 'recommendations'] as HomeTab[]).map((t) => (
            <button key={t} type="button" className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
              <span className="cl-home-tab-dot" aria-hidden />
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button type="button" className="cl-home-customize">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Customize
          </button>
        </nav>
      </div>

      {tab === 'dashboard' && (
        <div className="cl-home-grid">

          {/* 1 ── Project info */}
          <article className="cl-home-card">
            <header>
              <div className="cl-home-card-hd">
                <span className="cl-home-card-ico" style={{ '--ico-c': '#3d4138', '--ico-bg': 'hsl(80 12% 92%)' } as React.CSSProperties}>⬡</span>
                <h2>Project info</h2>
              </div>
              <CardMenu />
            </header>
            <dl className="cl-home-kv">
              <div>
                <dt>Project name</dt>
                <dd>{project?.name ?? <span className="cl-home-empty">—</span>}</dd>
              </div>
              <div>
                <dt>Project number</dt>
                <dd className="cl-home-mono">{project ? projectNumber(project.id) : <span className="cl-home-empty">—</span>}</dd>
              </div>
              <div>
                <dt>Project ID</dt>
                <dd className="cl-home-mono">{project?.slug ?? <span className="cl-home-empty">—</span>}</dd>
              </div>
            </dl>
            <CardLink onClick={() => open('iam-iam')}>Add people to this project</CardLink>
            <footer>
              <CardLink onClick={() => open('iam-manage-resources')}>Go to project settings</CardLink>
            </footer>
          </article>

          {/* 2 ── APIs */}
          <article className="cl-home-card cl-home-card--wide">
            <header>
              <div className="cl-home-card-hd">
                <span className="cl-home-card-ico" style={{ '--ico-c': '#1a6ef0', '--ico-bg': 'hsl(214 90% 96%)' } as React.CSSProperties}>◈</span>
                <h2>APIs</h2>
              </div>
              <CardMenu />
            </header>
            <p className="cl-home-chart-label">Requests / sec — last 6 h</p>
            <div className="cl-home-chart-area">
              <SparkChart />
              <p className="cl-home-chart-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                No data for the selected time frame
              </p>
            </div>
            <footer>
              <CardLink onClick={() => open('apis')}>Go to APIs overview</CardLink>
            </footer>
          </article>

          {/* 3 ── Status */}
          <article className={`cl-home-card cl-home-card--status${isHealthy ? ' is-ok' : ' is-warn'}`}>
            <header>
              <div className="cl-home-card-hd">
                <span className="cl-home-card-ico" style={{ '--ico-c': isHealthy ? '#0b8043' : '#b45309', '--ico-bg': isHealthy ? 'hsl(145 80% 94%)' : 'hsl(38 90% 95%)' } as React.CSSProperties}>
                  {isHealthy ? '◉' : '◌'}
                </span>
                <h2>Platform status</h2>
              </div>
              <CardMenu />
            </header>
            <div className="cl-home-status-body">
              <PulseDot ok={isHealthy} />
              <p className="cl-home-status-text">
                {isHealthy ? 'All services operational' : 'Some services degraded'}
              </p>
            </div>
            <div className="cl-home-status-rows">
              {STATUS_SERVICES.map((svc, i) => (
                <div key={svc} className="cl-home-status-row">
                  <span className={`cl-home-smini-dot${(!isHealthy && i === 2) ? ' is-warn' : ' is-ok'}`} aria-hidden />
                  <span>{svc}</span>
                </div>
              ))}
            </div>
            <footer>
              <CardLink href="https://comfy-starlight-51c0e7.netlify.app/health">Go to status dashboard</CardLink>
            </footer>
          </article>

          {/* 4 ── Resources */}
          <article className="cl-home-card cl-home-card--tall">
            <header>
              <div className="cl-home-card-hd">
                <span className="cl-home-card-ico" style={{ '--ico-c': '#7c3aed', '--ico-bg': 'hsl(262 80% 96%)' } as React.CSSProperties}>▦</span>
                <h2>Resources</h2>
              </div>
              <CardMenu />
            </header>
            <ul className="cl-home-resource-list">
              {RESOURCES.map((r) => {
                const m = SERVICE_META[r.id] ?? { icon: '◈', color: '#5a5f53', bg: 'hsl(80 8% 94%)' }
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => open(r.id)}>
                      <span className="cl-home-res-ico" style={{ color: m.color, background: m.bg }} aria-hidden>{m.icon}</span>
                      <span className="cl-home-res-text">
                        <strong>{r.label}</strong>
                        <span>{r.desc}</span>
                      </span>
                      <svg className="cl-home-res-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          </article>

          {/* 5 ── Monitoring */}
          <article className="cl-home-card">
            <header>
              <div className="cl-home-card-hd">
                <span className="cl-home-card-ico" style={{ '--ico-c': '#0369a1', '--ico-bg': 'hsl(200 80% 95%)' } as React.CSSProperties}>◎</span>
                <h2>Monitoring</h2>
              </div>
              <CardMenu />
            </header>
            <ul className="cl-home-action-list">
              {MONITORING_ACTIONS.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => open(a.id)}>
                    <span className="cl-home-action-ico" aria-hidden>{a.icon}</span>
                    {a.label}
                  </button>
                </li>
              ))}
            </ul>
            <footer>
              <button type="button" className="cl-home-text-link" onClick={() => open('monitoring')}>
                View all dashboards
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </footer>
          </article>

          {/* 6 ── Error Reporting */}
          <article className="cl-home-card">
            <header>
              <div className="cl-home-card-hd">
                <span className="cl-home-card-ico" style={{ '--ico-c': '#0b8043', '--ico-bg': 'hsl(145 80% 94%)' } as React.CSSProperties}>◉</span>
                <h2>Error Reporting</h2>
              </div>
              <CardMenu />
            </header>
            <div className="cl-home-err-body">
              <div className="cl-home-err-zero">
                <span className="cl-home-err-count">0</span>
                <span className="cl-home-err-lbl">errors detected</span>
              </div>
              <p className="cl-home-muted">No sign of any errors. Set up Error Reporting to start tracking.</p>
            </div>
            <footer>
              <CardLink onClick={() => open('mon-error-reporting')}>Learn how to set up Error Reporting</CardLink>
            </footer>
          </article>

          {/* 7 ── Getting Started */}
          <article className="cl-home-card cl-home-card--tall">
            <header>
              <div className="cl-home-card-hd">
                <span className="cl-home-card-ico" style={{ '--ico-c': '#c2410c', '--ico-bg': 'hsl(20 90% 95%)' } as React.CSSProperties}>▶</span>
                <h2>Getting Started</h2>
              </div>
              <CardMenu />
            </header>
            <ul className="cl-home-start-list">
              {GETTING_STARTED.map((item) => (
                <li key={item.label}>
                  {item.id ? (
                    <button type="button" onClick={() => open(item.id!)}>
                      <span className="cl-home-start-chk" aria-hidden>◌</span>
                      <span>{item.label}</span>
                      {item.badge && <em className="cl-home-start-badge">{item.badge}</em>}
                    </button>
                  ) : (
                    <span className="cl-home-muted-row">
                      <span className="cl-home-start-chk is-dim" aria-hidden>◌</span>
                      <span>{item.label}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <footer>
              <CardLink onClick={() => open('solutions-all')}>Explore all tutorials</CardLink>
            </footer>
          </article>

          {/* 8 ── News */}
          <article className="cl-home-card">
            <header>
              <div className="cl-home-card-hd">
                <span className="cl-home-card-ico" style={{ '--ico-c': '#7c3aed', '--ico-bg': 'hsl(262 80% 96%)' } as React.CSSProperties}>◈</span>
                <h2>News &amp; updates</h2>
              </div>
              <CardMenu />
            </header>
            <ul className="cl-home-news">
              {NEWS.map((n) => (
                <li key={n.title}>
                  <span className="cl-home-news-dot" style={{ background: n.dot }} aria-hidden />
                  <div className="cl-home-news-body">
                    <strong>{n.title}</strong>
                    <span>{n.ago}</span>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="cl-home-card-footer-split">
              <button type="button" className="cl-home-text-link">Read all news</button>
              <button type="button" className="cl-home-text-link">Release notes</button>
            </footer>
          </article>

          {/* 9 ── Documentation */}
          <article className="cl-home-card">
            <header>
              <div className="cl-home-card-hd">
                <span className="cl-home-card-ico" style={{ '--ico-c': '#1a6ef0', '--ico-bg': 'hsl(214 90% 96%)' } as React.CSSProperties}>▦</span>
                <h2>Documentation</h2>
              </div>
              <CardMenu />
            </header>
            <ul className="cl-home-doc-list">
              {DOCS.map((d) => (
                <li key={d.label}>
                  <button type="button" onClick={() => open(d.id)}>
                    <span className="cl-home-doc-ico" aria-hidden>{d.icon}</span>
                    {d.label}
                  </button>
                </li>
              ))}
            </ul>
          </article>

        </div>
      )}

      {tab === 'activity' && (
        <ActivityMonitoringView project={project} onOpenService={(id) => open(id)} />
      )}

      {tab === 'recommendations' && (
        <RecommendationsView project={project} onOpenService={(id) => open(id)} />
      )}
    </div>
  )
}
