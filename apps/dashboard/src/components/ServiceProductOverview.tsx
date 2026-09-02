'use client'

import {
  firstSubmenuId,
  flattenSubmenu,
  SERVICE_LABELS,
  type ServiceId,
} from './consoleNavMenus'

export interface ConsoleResourceStats {
  deployments: number
  running: number
  failed: number
  gateways: number
  buckets: number
  databases: number
  loadBalancers: number
  secrets: number
  apiHealthy: boolean | null
}

interface ServiceProductOverviewProps {
  tab: ServiceId
  stats: ConsoleResourceStats
  onNavigate: (id: ServiceId) => void
  variant?: 'overview' | 'stub'
}

const PRODUCT_COPY: Partial<Record<ServiceId, { blurb: string; live: string[] }>> = {
  run: {
    blurb: 'Deploy containerized services with scale-to-zero, public URLs, and async K8s provisioning.',
    live: ['Deploy services', 'Scale 0→N with KEDA', 'Live URLs on *.cloudlane.run'],
  },
  kubernetes: {
    blurb: 'Kubernetes-native workloads — same deploy pipeline as Cloud Run, backed by your cluster.',
    live: ['Clusters & workloads view', 'KEDA ScaledObjects', 'Ingress per deployment'],
  },
  gateway: {
    blurb: 'API Gateway with consumer keys, per-route auth, and nginx edge config generation.',
    live: ['Gateways + routes', 'API keys & rate limits', 'Deploy preview (nginx)'],
  },
  lb: {
    blurb: 'Layer-7 HTTP/HTTPS and Layer-4 TCP load balancers on gateway-proxy.',
    live: ['HTTP :8080', 'HTTPS TLS :8443', 'TCP :19400–19599'],
  },
  sql: {
    blurb: 'Managed Postgres/MySQL — shared engines or dedicated Docker containers per instance.',
    live: ['Real Postgres :5433 / MySQL :3307', 'Encrypted connection strings', 'Automated MinIO backups'],
  },
  databases: {
    blurb: 'Cloudlane database products. Cloud SQL is live; AlloyDB, Spanner, and others are on the roadmap.',
    live: ['Cloud SQL instances', 'Disk quotas', 'Daily backups'],
  },
  storage: {
    blurb: 'S3-compatible object storage on MinIO with presigned upload/download URLs.',
    live: ['Bucket CRUD', 'Object listing', 'Presigned URLs'],
  },
  security: {
    blurb: 'Secrets, audit logs, and ops vault for control-plane credential migration.',
    live: ['Tenant secret vault', 'Audit log stream', 'Cloudlane ops secrets'],
  },
  monitoring: {
    blurb: 'Deployment health, usage metrics, and quota visibility.',
    live: ['Running/failed counts', 'Metric summaries', 'Quota dashboard'],
  },
  billing: {
    blurb: 'Usage-based billing with IremboPay invoice generation and payment links.',
    live: ['Compute usage', 'Invoice sync', 'Pay links'],
  },
  apis: {
    blurb: 'Control-plane API keys for automation, CI, and the Cloudlane Terminal.',
    live: ['API key CRUD', 'Scoped deploy/read'],
  },
  vpc: {
    blurb: 'Private networking, VPC peering, and flow logs — planned for dedicated clusters.',
    live: [],
  },
}

function productRoot(tab: ServiceId): ServiceId {
  if (PRODUCT_COPY[tab]) return tab
  const prefix = tab.split('-')[0] as ServiceId
  if (PRODUCT_COPY[prefix]) return prefix
  return tab
}

export default function ServiceProductOverview({
  tab,
  stats,
  onNavigate,
  variant = 'overview',
}: ServiceProductOverviewProps) {
  const root = productRoot(tab)
  const copy = PRODUCT_COPY[root]
  const submenu = flattenSubmenu(root)
  const liveLinks = submenu.filter((item) => !item.id.includes('overview') && !item.id.includes('get-started'))

  const statCards = [
    { label: 'Deployments', value: stats.deployments, sub: `${stats.running} running`, tab: 'run-services' as ServiceId },
    { label: 'Gateways', value: stats.gateways, tab: 'gateway' as ServiceId },
    { label: 'Load balancers', value: stats.loadBalancers, tab: 'lb-load-balancers' as ServiceId },
    { label: 'Databases', value: stats.databases, tab: 'sql-instances' as ServiceId },
    { label: 'Buckets', value: stats.buckets, tab: 'storage' as ServiceId },
    { label: 'Secrets', value: stats.secrets, tab: 'sec-secret-manager' as ServiceId },
  ]

  const isStub = variant === 'stub' && !copy?.live.length

  return (
    <div className="cl-product-overview">
      <div className="cl-product-overview-hero">
        <h3>{SERVICE_LABELS[tab]}</h3>
        <p>{copy?.blurb ?? `${SERVICE_LABELS[tab]} — explore related sections from the navigation menu.`}</p>
        <div className="cl-product-overview-badges">
          <span className={`cl-badge ${stats.apiHealthy ? 'cl-badge--ok' : 'cl-badge--warn'}`}>
            API {stats.apiHealthy ? 'online' : 'check connection'}
          </span>
          {stats.failed > 0 && (
            <span className="cl-badge cl-badge--warn">{stats.failed} failed deployment(s)</span>
          )}
          {!isStub && <span className="cl-badge cl-badge--live">Live on Cloudlane</span>}
          {isStub && <span className="cl-badge">Roadmap</span>}
        </div>
      </div>

      <div className="cl-product-stat-grid">
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            className="cl-product-stat-card"
            onClick={() => onNavigate(card.tab)}
          >
            <strong>{card.value}</strong>
            <span>{card.label}</span>
            {card.sub && <em>{card.sub}</em>}
          </button>
        ))}
      </div>

      {copy?.live && copy.live.length > 0 && (
        <div className="cl-product-section">
          <h4>What works today</h4>
          <ul className="cl-product-feature-list">
            {copy.live.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {liveLinks.length > 0 && (
        <div className="cl-product-section">
          <h4>Go to</h4>
          <div className="cl-product-link-row">
            {liveLinks.slice(0, 6).map((item) => (
              <button key={item.id} type="button" className="gcp-btn-compact" onClick={() => onNavigate(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cl-product-section cl-product-terminal-cta">
        <h4>Cloudlane Terminal</h4>
        <p className="gcp-muted">
          Use the terminal icon in the top bar — run <code>deploy create</code>, <code>db list</code>,{' '}
          <code>lb list</code>, <code>quota</code>, and GraphQL queries without leaving the console.
        </p>
      </div>

      {isStub && (
        <p className="gcp-muted cl-product-roadmap">
          {SERVICE_LABELS[tab]} is on the roadmap. Use live sections above or open{' '}
          <button type="button" className="cl-link-btn" onClick={() => {
            const first = firstSubmenuId(root)
            if (first) onNavigate(first)
          }}>
            {SERVICE_LABELS[firstSubmenuId(root) ?? root]}
          </button>{' '}
          to get started.
        </p>
      )}
    </div>
  )
}
