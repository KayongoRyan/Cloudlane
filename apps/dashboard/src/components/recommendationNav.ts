export type RecNavId =
  | 'rec-dashboard'
  | 'rec-all'
  | 'rec-cost'
  | 'rec-security'
  | 'rec-performance'
  | 'rec-reliability'
  | 'rec-manageability'
  | 'rec-sustainability'
  | 'rec-applied-dismissed'
  | 'rec-bigquery-export'

export type RecNavItem = {
  id: RecNavId
  label: string
}

export type RecNavSection = {
  title: string
  items: RecNavItem[]
}

export const RECOMMENDATION_NAV_SECTIONS: RecNavSection[] = [
  {
    title: 'Recommendation Hub',
    items: [
      { id: 'rec-dashboard', label: 'Dashboard' },
      { id: 'rec-all', label: 'All recommendations' },
      { id: 'rec-cost', label: 'Cost' },
      { id: 'rec-security', label: 'Security' },
      { id: 'rec-performance', label: 'Performance' },
      { id: 'rec-reliability', label: 'Reliability' },
      { id: 'rec-manageability', label: 'Manageability' },
      { id: 'rec-sustainability', label: 'Sustainability' },
    ],
  },
  {
    title: 'Utilities',
    items: [
      { id: 'rec-applied-dismissed', label: 'Applied and dismissed' },
      { id: 'rec-bigquery-export', label: 'BigQuery export' },
    ],
  },
]

export const RECOMMENDATION_LABELS: Record<RecNavId, string> = {
  'rec-dashboard': 'Dashboard',
  'rec-all': 'All recommendations',
  'rec-cost': 'Cost',
  'rec-security': 'Security',
  'rec-performance': 'Performance',
  'rec-reliability': 'Reliability',
  'rec-manageability': 'Manageability',
  'rec-sustainability': 'Sustainability',
  'rec-applied-dismissed': 'Applied and dismissed',
  'rec-bigquery-export': 'BigQuery export',
}

export const REC_CATEGORY_DESCRIPTIONS: Partial<Record<RecNavId, string>> = {
  'rec-all': 'Categories help organize your recommendations',
  'rec-cost': 'Recommendations to reduce spend and improve cost efficiency',
  'rec-security': 'Security findings and hardening suggestions for your project',
  'rec-performance': 'Ways to improve latency, throughput, and resource usage',
  'rec-reliability': 'Improve uptime, redundancy, and fault tolerance',
  'rec-manageability': 'Simplify operations, monitoring, and day-2 management',
  'rec-sustainability': 'Reduce carbon footprint and optimize energy usage',
  'rec-applied-dismissed': 'History of recommendations you applied or dismissed',
  'rec-bigquery-export': 'Export recommendation data to BigQuery for analysis',
}
