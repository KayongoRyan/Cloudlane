import { SERVICE_LABELS, type ServiceId } from './consoleNavMenus'

export type ServiceCategory = {
  id: string
  label: string
  services: { id: ServiceId; label: string; desc?: string }[]
}

export const CONSOLE_SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'application-integration',
    label: 'Application Integration',
    services: [
      { id: 'apis', label: SERVICE_LABELS.apis, desc: 'APIs & event-driven integrations' },
      { id: 'agent', label: SERVICE_LABELS.agent, desc: 'Agent Platform workflows' },
    ],
  },
  {
    id: 'blockchain',
    label: 'Blockchain',
    services: [
      { id: 'marketplace', label: SERVICE_LABELS.marketplace, desc: 'Partner solutions catalog' },
    ],
  },
  {
    id: 'business-applications',
    label: 'Business Applications',
    services: [
      { id: 'solutions', label: SERVICE_LABELS.solutions, desc: 'Solution deployments' },
      { id: 'marketplace', label: SERVICE_LABELS.marketplace, desc: 'Prebuilt apps' },
    ],
  },
  {
    id: 'cloud-financial-management',
    label: 'Cloud Financial Management',
    services: [
      { id: 'billing', label: SERVICE_LABELS.billing, desc: 'Usage and invoices' },
      { id: 'mon-cost-explorer', label: 'Cost explorer', desc: 'Cost breakdowns' },
    ],
  },
  {
    id: 'compute',
    label: 'Compute',
    services: [
      { id: 'compute', label: SERVICE_LABELS.compute, desc: 'Virtual machines and disks' },
      { id: 'compute-vm-instances', label: 'VM instances', desc: 'Create and manage VMs' },
    ],
  },
  {
    id: 'containers',
    label: 'Containers',
    services: [
      { id: 'kubernetes', label: SERVICE_LABELS.kubernetes, desc: 'GKE clusters and workloads' },
      { id: 'run', label: SERVICE_LABELS.run, desc: 'Cloud Run services and jobs' },
    ],
  },
  {
    id: 'customer-enablement',
    label: 'Customer Enablement',
    services: [
      { id: 'hub-support', label: 'Support', desc: 'Help and documentation' },
      { id: 'solutions-all', label: 'All products', desc: 'Browse the catalog' },
    ],
  },
  {
    id: 'database',
    label: 'Database',
    services: [
      { id: 'databases', label: SERVICE_LABELS.databases, desc: 'Managed database catalog' },
      { id: 'sql', label: SERVICE_LABELS.sql, desc: 'Cloud SQL instances' },
      { id: 'db-alloydb', label: 'AlloyDB', desc: 'PostgreSQL-compatible' },
      { id: 'db-spanner', label: 'Spanner', desc: 'Globally distributed SQL' },
      { id: 'db-firestore', label: 'Firestore', desc: 'Document database' },
    ],
  },
  {
    id: 'developer-tools',
    label: 'Developer Tools',
    services: [
      { id: 'apis-credentials', label: 'API credentials', desc: 'Keys and OAuth' },
      { id: 'agent', label: SERVICE_LABELS.agent, desc: 'Build with agents' },
    ],
  },
  {
    id: 'end-user-computing',
    label: 'End User Computing',
    services: [
      { id: 'run-services', label: 'Cloud Run services', desc: 'Web apps and APIs' },
    ],
  },
  {
    id: 'frontend-mobile',
    label: 'Front-end Web & Mobile',
    services: [
      { id: 'run-services', label: 'Cloud Run', desc: 'Host web and mobile backends' },
      { id: 'storage', label: SERVICE_LABELS.storage, desc: 'Static assets and media' },
    ],
  },
  {
    id: 'game-development',
    label: 'Game Development',
    services: [
      { id: 'compute', label: SERVICE_LABELS.compute, desc: 'Game server VMs' },
      { id: 'kubernetes', label: SERVICE_LABELS.kubernetes, desc: 'Orchestrated game backends' },
    ],
  },
  {
    id: 'iot',
    label: 'Internet of Things',
    services: [
      { id: 'mon-logs-explorer', label: 'Logs explorer', desc: 'Device and telemetry logs' },
      { id: 'monitoring', label: SERVICE_LABELS.monitoring, desc: 'Metrics and alerting' },
    ],
  },
  {
    id: 'machine-learning',
    label: 'Machine Learning',
    services: [
      { id: 'agent', label: SERVICE_LABELS.agent, desc: 'Models and agents' },
      { id: 'bigquery', label: SERVICE_LABELS.bigquery, desc: 'Analytics and ML datasets' },
    ],
  },
  {
    id: 'management-governance',
    label: 'Management & Governance',
    services: [
      { id: 'iam', label: SERVICE_LABELS.iam, desc: 'Identity and access' },
      { id: 'iam-audit-logs', label: 'Audit logs', desc: 'Activity history' },
      { id: 'hub-quotas', label: 'Quotas', desc: 'Limits and reservations' },
    ],
  },
  {
    id: 'media-services',
    label: 'Media Services',
    services: [
      { id: 'storage', label: SERVICE_LABELS.storage, desc: 'Object storage for media' },
      { id: 'run-services', label: 'Transcode workers', desc: 'Serverless processing' },
    ],
  },
  {
    id: 'migration-transfer',
    label: 'Migration & Transfer',
    services: [
      { id: 'bq-migration-services', label: 'BigQuery migration', desc: 'Data warehouse migration' },
      { id: 'storage', label: SERVICE_LABELS.storage, desc: 'Bulk object transfer' },
    ],
  },
  {
    id: 'networking',
    label: 'Networking & Content Delivery',
    services: [
      { id: 'vpc', label: SERVICE_LABELS.vpc, desc: 'VPC networks and subnets' },
      { id: 'vpc-serverless-access', label: 'Serverless VPC access', desc: 'Private connectivity' },
    ],
  },
  {
    id: 'quantum',
    label: 'Quantum Technologies',
    services: [
      { id: 'solutions-all', label: 'Research solutions', desc: 'Partner catalog' },
    ],
  },
  {
    id: 'satellite',
    label: 'Satellite',
    services: [
      { id: 'marketplace', label: SERVICE_LABELS.marketplace, desc: 'Ground station partners' },
    ],
  },
  {
    id: 'security',
    label: 'Security, Identity, & Compliance',
    services: [
      { id: 'security', label: SERVICE_LABELS.security, desc: 'Security Command Center' },
      { id: 'iam', label: SERVICE_LABELS.iam, desc: 'IAM & admin' },
      { id: 'sec-findings', label: 'Security findings', desc: 'Detections and posture' },
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    services: [
      { id: 'storage', label: SERVICE_LABELS.storage, desc: 'Cloud Storage buckets' },
      { id: 'db-bigtable', label: 'Bigtable', desc: 'Wide-column NoSQL' },
    ],
  },
]

export const CONSOLE_QUICK_LINKS: { id: ServiceId; label: string }[] = [
  { id: 'compute', label: 'Compute' },
  { id: 'storage', label: 'Storage' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'iam', label: 'IAM' },
]
