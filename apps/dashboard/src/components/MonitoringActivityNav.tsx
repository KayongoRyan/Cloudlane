'use client'

import { ReactNode, useState } from 'react'
import {
  getSubmenuSections,
  SERVICE_LABELS,
  type ServiceId,
} from './consoleNavMenus'

const MONITORING_SECTIONS = getSubmenuSections('monitoring')

type MonNavId = Extract<ServiceId, `mon-${string}`>

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const MON_ICONS: Partial<Record<MonNavId, ReactNode>> = {
  'mon-overview': (
    <Icon><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" {...stroke} /></Icon>
  ),
  'mon-dashboards': (
    <Icon><rect x="4" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="4" y="13" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="13" width="7" height="7" rx="1" {...stroke} /></Icon>
  ),
  'mon-applications': (
    <Icon><path d="M4 18V6M4 18h16M20 18V10M12 18V8" {...stroke} /></Icon>
  ),
  'mon-metrics-explorer': (
    <Icon><path d="M5 19V9M10 19V5M15 19v-7M20 19V11" {...stroke} /></Icon>
  ),
  'mon-logs-explorer': (
    <Icon><path d="M5 7h14M5 12h14M5 17h14" {...stroke} /></Icon>
  ),
  'mon-observability-analytics': (
    <Icon><path d="M5 7h10M5 12h14M5 17h8" {...stroke} /><circle cx="18" cy="17" r="2.5" {...stroke} /></Icon>
  ),
  'mon-trace-explorer': (
    <Icon><path d="M6 8h12M8 12h10M10 16h8" {...stroke} /></Icon>
  ),
  'mon-cost-explorer': (
    <Icon><path d="M5 19V11M10 19V7M15 19v-5M20 19V5" {...stroke} /><path d="M4 9h16" {...stroke} strokeDasharray="2 3" /></Icon>
  ),
  'mon-alerting': (
    <Icon><path d="M12 4a4 4 0 0 1 4 4v3l1.5 2.5H6.5L8 11V8a4 4 0 0 1 4-4Z" {...stroke} /><path d="M10 18a2 2 0 0 0 4 0" {...stroke} /></Icon>
  ),
  'mon-error-reporting': (
    <Icon><path d="M12 3 4 7v6c0 4.5 3.5 7.5 8 9 4.5-1.5 8-4.5 8-9V7l-8-4Z" {...stroke} /><path d="M12 9v4M12 16h.01" {...stroke} /></Icon>
  ),
  'mon-uptime-checks': (
    <Icon><rect x="3" y="5" width="18" height="12" rx="2" {...stroke} /><path d="M8 15l3-3 2 2 5-5" {...stroke} /></Icon>
  ),
  'mon-system-monitoring': (
    <Icon><circle cx="8" cy="8" r="2" {...stroke} /><circle cx="16" cy="6" r="2" {...stroke} /><circle cx="12" cy="16" r="2" {...stroke} /><path d="M9.5 9.5 14.5 7.5M10 10.5 12.5 14.5" {...stroke} /></Icon>
  ),
  'mon-slos': (
    <Icon><circle cx="7" cy="12" r="2.5" {...stroke} /><circle cx="12" cy="12" r="3.5" {...stroke} /><circle cx="17" cy="12" r="2" {...stroke} /></Icon>
  ),
  'mon-integrations': (
    <Icon><path d="M8 12h8M12 8v8" {...stroke} /><circle cx="12" cy="12" r="8" {...stroke} /></Icon>
  ),
  'mon-log-metrics': (
    <Icon><rect x="5" y="5" width="14" height="14" rx="2" {...stroke} /><path d="M8 15V11M12 15V9M16 15v-3" {...stroke} /></Icon>
  ),
  'mon-log-router': (
    <Icon><path d="M7 7l4 4-4 4M17 7l-4 4 4 4" {...stroke} /></Icon>
  ),
  'mon-log-storage': (
    <Icon><rect x="5" y="4" width="14" height="16" rx="2" {...stroke} /><path d="M8 9h8M8 13h8M8 17h5" {...stroke} /></Icon>
  ),
  'mon-metrics-mgmt': (
    <Icon><path d="M4 18V6M20 18V10M12 18V8" {...stroke} /><circle cx="18" cy="6" r="2" {...stroke} /></Icon>
  ),
  'mon-groups': (
    <Icon><rect x="4" y="4" width="9" height="9" rx="1.5" {...stroke} /><rect x="11" y="11" width="9" height="9" rx="1.5" {...stroke} /></Icon>
  ),
  'mon-settings': (
    <Icon><circle cx="12" cy="12" r="3" {...stroke} /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" {...stroke} /></Icon>
  ),
  'mon-permissions': (
    <Icon><circle cx="12" cy="8" r="3.5" {...stroke} /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" {...stroke} /></Icon>
  ),
}

interface MonitoringActivityNavProps {
  active: MonNavId
  onSelect: (id: MonNavId) => void
}

export default function MonitoringActivityNav({ active, onSelect }: MonitoringActivityNavProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleSection = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <nav className="cl-activity-nav" aria-label="Monitoring">
      {MONITORING_SECTIONS.map((section) => {
        const isGrouped = Boolean(section.title)
        const isCollapsed = section.title ? collapsed[section.title] : false

        return (
          <div key={section.title ?? 'top'} className="cl-activity-nav-section">
            {section.title ? (
              <button
                type="button"
                className="cl-activity-nav-section-head"
                aria-expanded={!isCollapsed}
                onClick={() => toggleSection(section.title!)}
              >
                <span>{section.title}</span>
                <span className={`cl-activity-nav-chevron${isCollapsed ? ' is-collapsed' : ''}`} aria-hidden>
                  ^
                </span>
              </button>
            ) : null}

            {!isCollapsed && (
              <ul className={isGrouped ? 'cl-activity-nav-group' : undefined}>
                {section.items.map((item) => {
                  const id = item.id as MonNavId
                  const isActive = active === id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`cl-activity-nav-item${isActive ? ' is-active' : ''}`}
                        onClick={() => onSelect(id)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className="cl-activity-nav-icon">{MON_ICONS[id]}</span>
                        <span>{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export function monitoringActivityLabel(id: MonNavId): string {
  return SERVICE_LABELS[id]
}

export type { MonNavId }
