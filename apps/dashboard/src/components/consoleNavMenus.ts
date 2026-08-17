export type ServiceId =
  | 'hub'
  | 'hub-home'
  | 'hub-deployments'
  | 'hub-health'
  | 'hub-security-compliance'
  | 'hub-optimization'
  | 'hub-quotas'
  | 'hub-maintenance'
  | 'hub-support'
  | 'solutions'
  | 'solutions-all'
  | 'solutions-deployments'
  | 'solutions-app-design'
  | 'billing'
  | 'iam'
  | 'iam-iam'
  | 'iam-service-accounts'
  | 'iam-groups'
  | 'iam-pam'
  | 'iam-roles'
  | 'iam-workload-identity'
  | 'iam-workforce-identity'
  | 'iam-principal-boundary'
  | 'iam-managed-workload-identities'
  | 'iam-org-policies'
  | 'iam-asset-inventory'
  | 'iam-settings'
  | 'iam-labels'
  | 'iam-tags'
  | 'iam-manage-resources'
  | 'iam-create-project'
  | 'iam-security-insights'
  | 'iam-policy-analyzer'
  | 'iam-policy-troubleshooter'
  | 'iam-quotas'
  | 'iam-audit-logs'
  | 'iam-identity-org'
  | 'iam-essential-contacts'
  | 'iam-privacy-security'
  | 'iam-iap'
  | 'marketplace'
  | 'apis'
  | 'apis-enabled'
  | 'apis-library'
  | 'apis-credentials'
  | 'apis-oauth-consent'
  | 'apis-page-usage'
  | 'agent'
  | 'agent-overview'
  | 'agent-studio'
  | 'agent-models'
  | 'agent-agents'
  | 'compute'
  | 'compute-overview'
  | 'compute-advisor'
  | 'compute-vm-instances'
  | 'compute-instance-templates'
  | 'compute-sole-tenant'
  | 'compute-machine-images'
  | 'compute-tpus'
  | 'compute-committed-discounts'
  | 'compute-reservations'
  | 'compute-capacity-advisor'
  | 'compute-migrate-vms'
  | 'compute-disks'
  | 'compute-storage-pools'
  | 'compute-snapshots'
  | 'compute-images'
  | 'compute-async-replication'
  | 'compute-consistency-groups'
  | 'compute-instance-groups'
  | 'compute-health-checks'
  | 'compute-vm-extension-policies'
  | 'compute-patch'
  | 'compute-os-policies'
  | 'compute-bms-servers'
  | 'compute-bms-networks'
  | 'compute-bms-vrfs'
  | 'compute-bms-volumes'
  | 'compute-bms-nfs'
  | 'compute-bms-procurements'
  | 'compute-bms-maintenance'
  | 'compute-operations'
  | 'compute-settings'
  | 'compute-metadata'
  | 'compute-zones'
  | 'kubernetes'
  | 'k8s-overview'
  | 'k8s-clusters'
  | 'k8s-workloads'
  | 'k8s-aiml'
  | 'k8s-teams'
  | 'k8s-applications'
  | 'k8s-secrets'
  | 'k8s-storage'
  | 'k8s-object-browser'
  | 'k8s-backup'
  | 'k8s-security'
  | 'k8s-policy'
  | 'k8s-gateways'
  | 'k8s-network-optimizer'
  | 'k8s-feature-manager'
  | 'k8s-service-mesh'
  | 'k8s-config'
  | 'k8s-identity-service'
  | 'storage'
  | 'security'
  | 'sec-scc-overview'
  | 'sec-graph-search'
  | 'sec-issues'
  | 'sec-findings'
  | 'sec-assets'
  | 'sec-compliance'
  | 'sec-posture'
  | 'sec-rules'
  | 'sec-sources'
  | 'sec-secops'
  | 'sec-fraud-defense'
  | 'sec-model-armor'
  | 'sec-web-scanner'
  | 'sec-cyber-insurance'
  | 'sec-binary-auth'
  | 'sec-advisory-notifications'
  | 'sec-access-approval'
  | 'sec-sensitive-data'
  | 'sec-dlp'
  | 'sec-data-security'
  | 'sec-ca-service'
  | 'sec-kms'
  | 'sec-cert-manager'
  | 'sec-secret-manager'
  | 'sec-console-access-policy'
  | 'sec-enterprise-premium'
  | 'sec-iap'
  | 'sec-vpc-sc'
  | 'sec-access-context'
  | 'sec-secure-gateway'
  | 'bigquery'
  | 'bq-overview'
  | 'bq-studio'
  | 'bq-agents'
  | 'bq-data-transfers'
  | 'bq-dataform'
  | 'bq-scheduled-queries'
  | 'bq-scheduling'
  | 'bq-sharing'
  | 'bq-policy-tags'
  | 'bq-metadata-curation'
  | 'bq-monitoring'
  | 'bq-job-explorer'
  | 'bq-workload-mgmt'
  | 'bq-bi-engine'
  | 'bq-disaster-recovery'
  | 'bq-recommendations'
  | 'bq-migration-services'
  | 'monitoring'
  | 'run'
  | 'vpc'
  | 'databases'
  | 'sql'

export type SubMenuItem = { id: ServiceId; label: string }

export type SubMenuSection = {
  title?: string
  items: SubMenuItem[]
}

export const SERVICE_LABELS: Record<ServiceId, string> = {
  hub: 'Cloud Hub',
  'hub-home': 'Home',
  'hub-deployments': 'Deployments',
  'hub-health': 'Health & Troubleshooting',
  'hub-security-compliance': 'Security & Compliance',
  'hub-optimization': 'Optimization',
  'hub-quotas': 'Quotas & reservations',
  'hub-maintenance': 'Maintenance',
  'hub-support': 'Support',
  solutions: 'Solutions',
  'solutions-all': 'All Products',
  'solutions-deployments': 'Solution Deployments',
  'solutions-app-design': 'App Design Center',
  billing: 'Billing',
  iam: 'IAM & Admin',
  'iam-iam': 'IAM',
  'iam-service-accounts': 'Service Accounts',
  'iam-groups': 'Groups',
  'iam-pam': 'Privileged Access Manager',
  'iam-roles': 'Roles',
  'iam-workload-identity': 'Workload Identity Federation',
  'iam-workforce-identity': 'Workforce Identity Federation',
  'iam-principal-boundary': 'Principal Access Boundary',
  'iam-managed-workload-identities': 'Managed Workload Identities',
  'iam-org-policies': 'Organization Policies',
  'iam-asset-inventory': 'Asset Inventory',
  'iam-settings': 'Settings',
  'iam-labels': 'Labels',
  'iam-tags': 'Tags',
  'iam-manage-resources': 'Manage Resources',
  'iam-create-project': 'Create a Project',
  'iam-security-insights': 'Security Insights',
  'iam-policy-analyzer': 'Policy Analyzer',
  'iam-policy-troubleshooter': 'Policy Troubleshooter',
  'iam-quotas': 'Quotas & System Limits',
  'iam-audit-logs': 'Audit Logs',
  'iam-identity-org': 'Identity & Organization',
  'iam-essential-contacts': 'Essential Contacts',
  'iam-privacy-security': 'Privacy & Security',
  'iam-iap': 'Identity-Aware Proxy',
  marketplace: 'Marketplace',
  apis: 'APIs & Services',
  'apis-enabled': 'Enabled APIs & Services',
  'apis-library': 'Library',
  'apis-credentials': 'Credentials',
  'apis-oauth-consent': 'OAuth consent screen',
  'apis-page-usage': 'Page usage agreements',
  agent: 'Agent Platform',
  'agent-overview': 'Overview',
  'agent-studio': 'Studio',
  'agent-models': 'Models',
  'agent-agents': 'Agents',
  compute: 'Compute Engine',
  'compute-overview': 'Overview',
  'compute-advisor': 'Compute Advisor',
  'compute-vm-instances': 'VM instances',
  'compute-instance-templates': 'Instance templates',
  'compute-sole-tenant': 'Sole-tenant nodes',
  'compute-machine-images': 'Machine Images',
  'compute-tpus': 'TPUs',
  'compute-committed-discounts': 'Committed use discounts',
  'compute-reservations': 'Reservations',
  'compute-capacity-advisor': 'Capacity advisor',
  'compute-migrate-vms': 'Migrate to Virtual Machines',
  'compute-disks': 'Disks',
  'compute-storage-pools': 'Storage Pools',
  'compute-snapshots': 'Snapshots',
  'compute-images': 'Images',
  'compute-async-replication': 'Async Replication',
  'compute-consistency-groups': 'Consistency Groups',
  'compute-instance-groups': 'Instance groups',
  'compute-health-checks': 'Health checks',
  'compute-vm-extension-policies': 'VM extension policies',
  'compute-patch': 'Patch',
  'compute-os-policies': 'OS policies',
  'compute-bms-servers': 'Servers',
  'compute-bms-networks': 'Networks',
  'compute-bms-vrfs': 'VRFs',
  'compute-bms-volumes': 'Volumes',
  'compute-bms-nfs': 'NFS Shares',
  'compute-bms-procurements': 'Procurements',
  'compute-bms-maintenance': 'Maintenance Events',
  'compute-operations': 'Operations',
  'compute-settings': 'Settings',
  'compute-metadata': 'Metadata',
  'compute-zones': 'Zones',
  kubernetes: 'Kubernetes Engine',
  'k8s-overview': 'Overview',
  'k8s-clusters': 'Clusters',
  'k8s-workloads': 'Workloads',
  'k8s-aiml': 'AI/ML',
  'k8s-teams': 'Teams',
  'k8s-applications': 'Applications',
  'k8s-secrets': 'Secrets & ConfigMaps',
  'k8s-storage': 'Storage',
  'k8s-object-browser': 'Object Browser',
  'k8s-backup': 'Backup for GKE',
  'k8s-security': 'Security',
  'k8s-policy': 'Policy',
  'k8s-gateways': 'Gateways, Services & Ingress',
  'k8s-network-optimizer': 'Network Function Optimizer',
  'k8s-feature-manager': 'Feature Manager',
  'k8s-service-mesh': 'Service Mesh',
  'k8s-config': 'Config',
  'k8s-identity-service': 'Identity Service',
  storage: 'Cloud Storage',
  security: 'Security',
  'sec-scc-overview': 'Overview',
  'sec-graph-search': 'Graph Search',
  'sec-issues': 'Issues',
  'sec-findings': 'Findings',
  'sec-assets': 'Assets',
  'sec-compliance': 'Compliance',
  'sec-posture': 'Posture Management',
  'sec-rules': 'Rules',
  'sec-sources': 'Sources',
  'sec-secops': 'Cloudlane SecOps',
  'sec-fraud-defense': 'Fraud Defense',
  'sec-model-armor': 'Model Armor',
  'sec-web-scanner': 'Web security scanner',
  'sec-cyber-insurance': 'Cyber insurance Hub',
  'sec-binary-auth': 'Binary Authorization',
  'sec-advisory-notifications': 'Advisory Notifications',
  'sec-access-approval': 'Access Approval',
  'sec-sensitive-data': 'Sensitive Data Protection',
  'sec-dlp': 'Data Loss Prevention',
  'sec-data-security': 'Data Security & Compliance',
  'sec-ca-service': 'Certificate Authority service',
  'sec-kms': 'Key Management',
  'sec-cert-manager': 'Certificate Manager',
  'sec-secret-manager': 'Secret Manager',
  'sec-console-access-policy': 'Console & APIs access Policy',
  'sec-enterprise-premium': 'Cloudlane Enterprise Premium',
  'sec-iap': 'Identity-Aware Proxy',
  'sec-vpc-sc': 'VPC service controls',
  'sec-access-context': 'Access Context Manager',
  'sec-secure-gateway': 'Secure Gateway',
  bigquery: 'BigQuery',
  'bq-overview': 'Overview',
  'bq-studio': 'Studio',
  'bq-agents': 'Agents',
  'bq-data-transfers': 'Data transfers',
  'bq-dataform': 'Dataform',
  'bq-scheduled-queries': 'Scheduled queries',
  'bq-scheduling': 'Scheduling',
  'bq-sharing': 'Sharing (Analytics Hub)',
  'bq-policy-tags': 'Policy tags',
  'bq-metadata-curation': 'Metadata curation',
  'bq-monitoring': 'Monitoring',
  'bq-job-explorer': 'Job Explorer',
  'bq-workload-mgmt': 'Workload management',
  'bq-bi-engine': 'BI Engine',
  'bq-disaster-recovery': 'Disaster recovery',
  'bq-recommendations': 'Recommendations',
  'bq-migration-services': 'Services',
  monitoring: 'Monitoring',
  run: 'Cloud Run',
  vpc: 'VPC Network',
  databases: 'Databases',
  sql: 'Cloud SQL',
}

export const SUBMENU_SECTIONS: Partial<Record<ServiceId, SubMenuSection[]>> = {
  hub: [{
    items: [
      { id: 'hub-home', label: 'Home' },
      { id: 'hub-deployments', label: 'Deployments' },
      { id: 'hub-health', label: 'Health & Troubleshooting' },
      { id: 'hub-security-compliance', label: 'Security & Compliance' },
      { id: 'hub-optimization', label: 'Optimization' },
      { id: 'hub-quotas', label: 'Quotas & reservations' },
      { id: 'hub-maintenance', label: 'Maintenance' },
      { id: 'hub-support', label: 'Support' },
    ],
  }],
  solutions: [{
    items: [
      { id: 'solutions-all', label: 'All Products' },
      { id: 'solutions-deployments', label: 'Solution Deployments' },
      { id: 'solutions-app-design', label: 'App Design Center' },
    ],
  }],
  iam: [
    {
      title: 'Identity & Access',
      items: [
        { id: 'iam-iam', label: 'IAM' },
        { id: 'iam-service-accounts', label: 'Service Accounts' },
        { id: 'iam-groups', label: 'Groups' },
        { id: 'iam-pam', label: 'Privileged Access Manager' },
        { id: 'iam-roles', label: 'Roles' },
        { id: 'iam-workload-identity', label: 'Workload Identity Federation' },
        { id: 'iam-workforce-identity', label: 'Workforce Identity Federation' },
        { id: 'iam-principal-boundary', label: 'Principal Access Boundary' },
        { id: 'iam-managed-workload-identities', label: 'Managed Workload Identities' },
      ],
    },
    {
      title: 'Resource Management',
      items: [
        { id: 'iam-org-policies', label: 'Organization Policies' },
        { id: 'iam-asset-inventory', label: 'Asset Inventory' },
        { id: 'iam-settings', label: 'Settings' },
        { id: 'iam-labels', label: 'Labels' },
        { id: 'iam-tags', label: 'Tags' },
        { id: 'iam-manage-resources', label: 'Manage Resources' },
        { id: 'iam-create-project', label: 'Create a Project' },
      ],
    },
    {
      title: 'Diagnostic Tools',
      items: [
        { id: 'iam-security-insights', label: 'Security Insights' },
        { id: 'iam-policy-analyzer', label: 'Policy Analyzer' },
        { id: 'iam-policy-troubleshooter', label: 'Policy Troubleshooter' },
      ],
    },
    {
      title: 'Cloud Administration',
      items: [
        { id: 'iam-quotas', label: 'Quotas & System Limits' },
        { id: 'iam-audit-logs', label: 'Audit Logs' },
        { id: 'iam-identity-org', label: 'Identity & Organization' },
        { id: 'iam-essential-contacts', label: 'Essential Contacts' },
        { id: 'iam-privacy-security', label: 'Privacy & Security' },
      ],
    },
    {
      title: 'Access Risk',
      items: [
        { id: 'iam-iap', label: 'Identity-Aware Proxy' },
      ],
    },
  ],
  apis: [{
    items: [
      { id: 'apis-enabled', label: 'Enabled APIs & Services' },
      { id: 'apis-library', label: 'Library' },
      { id: 'apis-credentials', label: 'Credentials' },
      { id: 'apis-oauth-consent', label: 'OAuth consent screen' },
      { id: 'apis-page-usage', label: 'Page usage agreements' },
    ],
  }],
  agent: [{
    items: [
      { id: 'agent-overview', label: 'Overview' },
      { id: 'agent-studio', label: 'Studio' },
      { id: 'agent-models', label: 'Models' },
      { id: 'agent-agents', label: 'Agents' },
    ],
  }],
  compute: [
    {
      items: [
        { id: 'compute-overview', label: 'Overview' },
        { id: 'compute-advisor', label: 'Compute Advisor' },
      ],
    },
    {
      title: 'Virtual machines',
      items: [
        { id: 'compute-vm-instances', label: 'VM instances' },
        { id: 'compute-instance-templates', label: 'Instance templates' },
        { id: 'compute-sole-tenant', label: 'Sole-tenant nodes' },
        { id: 'compute-machine-images', label: 'Machine Images' },
        { id: 'compute-tpus', label: 'TPUs' },
        { id: 'compute-committed-discounts', label: 'Committed use discounts' },
        { id: 'compute-reservations', label: 'Reservations' },
        { id: 'compute-capacity-advisor', label: 'Capacity advisor' },
        { id: 'compute-migrate-vms', label: 'Migrate to Virtual Machines' },
      ],
    },
    {
      title: 'Storage',
      items: [
        { id: 'compute-disks', label: 'Disks' },
        { id: 'compute-storage-pools', label: 'Storage Pools' },
        { id: 'compute-snapshots', label: 'Snapshots' },
        { id: 'compute-images', label: 'Images' },
        { id: 'compute-async-replication', label: 'Async Replication' },
        { id: 'compute-consistency-groups', label: 'Consistency Groups' },
      ],
    },
    {
      title: 'Instance groups',
      items: [
        { id: 'compute-instance-groups', label: 'Instance groups' },
        { id: 'compute-health-checks', label: 'Health checks' },
      ],
    },
    {
      title: 'VM extension manager',
      items: [
        { id: 'compute-vm-extension-policies', label: 'VM extension policies' },
      ],
    },
    {
      title: 'VM Manager',
      items: [
        { id: 'compute-patch', label: 'Patch' },
        { id: 'compute-os-policies', label: 'OS policies' },
      ],
    },
    {
      title: 'Bare Metal Solution',
      items: [
        { id: 'compute-bms-servers', label: 'Servers' },
        { id: 'compute-bms-networks', label: 'Networks' },
        { id: 'compute-bms-vrfs', label: 'VRFs' },
        { id: 'compute-bms-volumes', label: 'Volumes' },
        { id: 'compute-bms-nfs', label: 'NFS Shares' },
        { id: 'compute-bms-procurements', label: 'Procurements' },
        { id: 'compute-bms-maintenance', label: 'Maintenance Events' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { id: 'compute-operations', label: 'Operations' },
        { id: 'compute-settings', label: 'Settings' },
        { id: 'compute-metadata', label: 'Metadata' },
        { id: 'compute-zones', label: 'Zones' },
      ],
    },
  ],
  kubernetes: [
    {
      title: 'Resource Management',
      items: [
        { id: 'k8s-overview', label: 'Overview' },
        { id: 'k8s-clusters', label: 'Clusters' },
        { id: 'k8s-workloads', label: 'Workloads' },
        { id: 'k8s-aiml', label: 'AI/ML' },
        { id: 'k8s-teams', label: 'Teams' },
        { id: 'k8s-applications', label: 'Applications' },
        { id: 'k8s-secrets', label: 'Secrets & ConfigMaps' },
        { id: 'k8s-storage', label: 'Storage' },
        { id: 'k8s-object-browser', label: 'Object Browser' },
        { id: 'k8s-backup', label: 'Backup for GKE' },
      ],
    },
    {
      title: 'Posture Management',
      items: [
        { id: 'k8s-security', label: 'Security' },
        { id: 'k8s-policy', label: 'Policy' },
      ],
    },
    {
      title: 'Networking',
      items: [
        { id: 'k8s-gateways', label: 'Gateways, Services & Ingress' },
        { id: 'k8s-network-optimizer', label: 'Network Function Optimizer' },
      ],
    },
    {
      title: 'Features',
      items: [
        { id: 'k8s-feature-manager', label: 'Feature Manager' },
        { id: 'k8s-service-mesh', label: 'Service Mesh' },
        { id: 'k8s-config', label: 'Config' },
        { id: 'k8s-identity-service', label: 'Identity Service' },
      ],
    },
  ],
  security: [
    {
      title: 'Security Command Center',
      items: [
        { id: 'sec-scc-overview', label: 'Overview' },
        { id: 'sec-graph-search', label: 'Graph Search' },
        { id: 'sec-issues', label: 'Issues' },
        { id: 'sec-findings', label: 'Findings' },
        { id: 'sec-assets', label: 'Assets' },
        { id: 'sec-compliance', label: 'Compliance' },
        { id: 'sec-posture', label: 'Posture Management' },
        { id: 'sec-rules', label: 'Rules' },
        { id: 'sec-sources', label: 'Sources' },
      ],
    },
    {
      title: 'Detections and Controls',
      items: [
        { id: 'sec-secops', label: 'Cloudlane SecOps' },
        { id: 'sec-fraud-defense', label: 'Fraud Defense' },
        { id: 'sec-model-armor', label: 'Model Armor' },
        { id: 'sec-web-scanner', label: 'Web security scanner' },
        { id: 'sec-cyber-insurance', label: 'Cyber insurance Hub' },
        { id: 'sec-binary-auth', label: 'Binary Authorization' },
        { id: 'sec-advisory-notifications', label: 'Advisory Notifications' },
        { id: 'sec-access-approval', label: 'Access Approval' },
      ],
    },
    {
      title: 'Data Protection',
      items: [
        { id: 'sec-sensitive-data', label: 'Sensitive Data Protection' },
        { id: 'sec-dlp', label: 'Data Loss Prevention' },
        { id: 'sec-data-security', label: 'Data Security & Compliance' },
        { id: 'sec-ca-service', label: 'Certificate Authority service' },
        { id: 'sec-kms', label: 'Key Management' },
        { id: 'sec-cert-manager', label: 'Certificate Manager' },
        { id: 'sec-secret-manager', label: 'Secret Manager' },
      ],
    },
    {
      title: 'Zero Trust',
      items: [
        { id: 'sec-console-access-policy', label: 'Console & APIs access Policy' },
        { id: 'sec-enterprise-premium', label: 'Cloudlane Enterprise Premium' },
        { id: 'sec-iap', label: 'Identity-Aware Proxy' },
        { id: 'sec-vpc-sc', label: 'VPC service controls' },
        { id: 'sec-access-context', label: 'Access Context Manager' },
        { id: 'sec-secure-gateway', label: 'Secure Gateway' },
      ],
    },
  ],
  bigquery: [
    {
      items: [
        { id: 'bq-overview', label: 'Overview' },
        { id: 'bq-studio', label: 'Studio' },
        { id: 'bq-agents', label: 'Agents' },
      ],
    },
    {
      title: 'Pipelines & Integration',
      items: [
        { id: 'bq-data-transfers', label: 'Data transfers' },
        { id: 'bq-dataform', label: 'Dataform' },
        { id: 'bq-scheduled-queries', label: 'Scheduled queries' },
        { id: 'bq-scheduling', label: 'Scheduling' },
      ],
    },
    {
      title: 'Governance',
      items: [
        { id: 'bq-sharing', label: 'Sharing (Analytics Hub)' },
        { id: 'bq-policy-tags', label: 'Policy tags' },
        { id: 'bq-metadata-curation', label: 'Metadata curation' },
      ],
    },
    {
      title: 'Administration',
      items: [
        { id: 'bq-monitoring', label: 'Monitoring' },
        { id: 'bq-job-explorer', label: 'Job Explorer' },
        { id: 'bq-workload-mgmt', label: 'Workload management' },
        { id: 'bq-bi-engine', label: 'BI Engine' },
        { id: 'bq-disaster-recovery', label: 'Disaster recovery' },
        { id: 'bq-recommendations', label: 'Recommendations' },
      ],
    },
    {
      title: 'Migration',
      items: [
        { id: 'bq-migration-services', label: 'Services' },
      ],
    },
  ],
}

export function getSubmenuSections(id: ServiceId): SubMenuSection[] {
  return SUBMENU_SECTIONS[id] ?? []
}

export function flattenSubmenu(id: ServiceId): SubMenuItem[] {
  return getSubmenuSections(id).flatMap((section) => section.items)
}

export function firstSubmenuId(id: ServiceId): ServiceId | undefined {
  return flattenSubmenu(id)[0]?.id
}

export function isActiveInMenu(active: ServiceId, parentId: ServiceId): boolean {
  if (active === parentId) return true
  return flattenSubmenu(parentId).some((item) => item.id === active)
}

export const IAM_PROJECT_TABS: ServiceId[] = ['iam', 'iam-iam', 'iam-create-project', 'iam-manage-resources']
export const COMPUTE_VM_TABS: ServiceId[] = ['compute', 'compute-vm-instances']
export const K8S_DEPLOY_TABS: ServiceId[] = ['kubernetes', 'k8s-clusters', 'k8s-workloads']
export const SECURITY_AUDIT_TABS: ServiceId[] = [
  'security',
  'sec-scc-overview',
  'sec-findings',
  'hub-security-compliance',
  'iam-audit-logs',
]

const OVERVIEW_TABS = new Set<ServiceId>([
  'compute-overview',
  'k8s-overview',
  'sec-scc-overview',
  'bq-overview',
  'agent-overview',
])

export function isIamStubTab(tab: ServiceId): boolean {
  return tab.startsWith('iam-')
    && !IAM_PROJECT_TABS.includes(tab)
    && tab !== 'iam-audit-logs'
}

export function isApisStubTab(tab: ServiceId): boolean {
  return tab.startsWith('apis-') && tab !== 'apis-credentials'
}

export function isAgentStubTab(tab: ServiceId): boolean {
  return tab.startsWith('agent-') && tab !== 'agent-overview'
}

export function isComputeStubTab(tab: ServiceId): boolean {
  return tab.startsWith('compute-') && !COMPUTE_VM_TABS.includes(tab)
}

export function isK8sStubTab(tab: ServiceId): boolean {
  return tab.startsWith('k8s-') && !K8S_DEPLOY_TABS.includes(tab)
}

export function isSecurityStubTab(tab: ServiceId): boolean {
  return tab.startsWith('sec-') && !SECURITY_AUDIT_TABS.includes(tab)
}

export function isBigQueryStubTab(tab: ServiceId): boolean {
  return tab.startsWith('bq-') && tab !== 'bq-overview'
}

export function isOverviewTab(tab: ServiceId): boolean {
  return OVERVIEW_TABS.has(tab)
}

export function isProductStubTab(tab: ServiceId): boolean {
  return isIamStubTab(tab)
    || isApisStubTab(tab)
    || isAgentStubTab(tab)
    || isComputeStubTab(tab)
    || isK8sStubTab(tab)
    || isSecurityStubTab(tab)
    || isBigQueryStubTab(tab)
}
