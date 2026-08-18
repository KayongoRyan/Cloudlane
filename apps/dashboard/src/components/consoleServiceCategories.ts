export type ServiceCategory = {
  title: string
}

/** AWS-style console service categories (titles only). */
export const CONSOLE_SERVICE_CATEGORIES: ServiceCategory[] = [
  { title: 'Application Integration' },
  { title: 'Blockchain' },
  { title: 'Business Applications' },
  { title: 'Cloud Financial Management' },
  { title: 'Compute' },
  { title: 'Containers' },
  { title: 'Customer Enablement' },
  { title: 'Database' },
  { title: 'Developer Tools' },
  { title: 'End User Computing' },
  { title: 'Front-end Web & Mobile' },
  { title: 'Game Development' },
  { title: 'Internet of Things' },
  { title: 'Machine Learning' },
  { title: 'Management & Governance' },
  { title: 'Media Services' },
  { title: 'Migration & Transfer' },
  { title: 'Networking & Content Delivery' },
  { title: 'Quantum Technologies' },
  { title: 'Satellite' },
  { title: 'Security, Identity, & Compliance' },
  { title: 'Storage' },
]

export const CONSOLE_QUICK_CATEGORIES = [
  'Compute',
  'Containers',
  'Storage',
  'Management & Governance',
]
