'use client'

import { ReactNode, useState } from 'react'
import {
  RECOMMENDATION_NAV_SECTIONS,
  type RecNavId,
} from './recommendationNav'

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

const REC_ICONS: Record<RecNavId, ReactNode> = {
  'rec-dashboard': (
    <Icon><path d="M4 6h6v6H4V6ZM14 6h6v4h-6V6ZM14 14h6v4h-6v-4ZM4 16h6v2H4v-2Z" {...stroke} /></Icon>
  ),
  'rec-all': (
    <Icon><path d="M12 3a5 5 0 0 0-2 9.6V16h4v-3.4A5 5 0 0 0 12 3Z" {...stroke} /><path d="M9 19h6" {...stroke} /></Icon>
  ),
  'rec-cost': (
    <Icon><circle cx="12" cy="12" r="8" {...stroke} /><path d="M9 10h6M9 14h4" {...stroke} /></Icon>
  ),
  'rec-security': (
    <Icon><path d="M12 3 4 7v6c0 4.5 3.5 7.5 8 9 4.5-1.5 8-4.5 8-9V7l-8-4Z" {...stroke} /></Icon>
  ),
  'rec-performance': (
    <Icon><path d="M4 18V6M20 18V10M12 18V8" {...stroke} /></Icon>
  ),
  'rec-reliability': (
    <Icon><circle cx="12" cy="12" r="8" {...stroke} /><path d="M12 8v4l3 2" {...stroke} /></Icon>
  ),
  'rec-manageability': (
    <Icon><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" {...stroke} /></Icon>
  ),
  'rec-sustainability': (
    <Icon><path d="M12 21c4-3 7-6.5 7-10a7 7 0 1 0-14 0c0 3.5 3 7 7 10Z" {...stroke} /><path d="M12 11V7" {...stroke} /></Icon>
  ),
  'rec-applied-dismissed': (
    <Icon><circle cx="12" cy="12" r="8" {...stroke} /><path d="M12 8v4l2.5 1.5" {...stroke} /></Icon>
  ),
  'rec-bigquery-export': (
    <Icon><path d="M12 3v12M8 11l4 4 4-4M5 19h14" {...stroke} /></Icon>
  ),
}

interface RecommendationActivityNavProps {
  active: RecNavId
  onSelect: (id: RecNavId) => void
}

export default function RecommendationActivityNav({ active, onSelect }: RecommendationActivityNavProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleSection = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <nav className="cl-activity-nav cl-rec-nav" aria-label="Active Assist">
      <div className="cl-rec-nav-brand">
        <span className="cl-rec-nav-brand-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 18V6M12 18V10M18 18V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <span>Active Assist</span>
      </div>

      {RECOMMENDATION_NAV_SECTIONS.map((section) => {
        const isCollapsed = collapsed[section.title]

        return (
          <div key={section.title} className="cl-activity-nav-section">
            <button
              type="button"
              className="cl-activity-nav-section-head cl-rec-nav-section-head"
              aria-expanded={!isCollapsed}
              onClick={() => toggleSection(section.title)}
            >
              <span>{section.title}</span>
              <span className={`cl-activity-nav-chevron${isCollapsed ? ' is-collapsed' : ''}`} aria-hidden>
                ^
              </span>
            </button>

            {!isCollapsed && (
              <ul className="cl-activity-nav-group">
                {section.items.map((item) => {
                  const isActive = active === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`cl-activity-nav-item cl-rec-nav-item${isActive ? ' is-active' : ''}`}
                        onClick={() => onSelect(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className="cl-activity-nav-icon">{REC_ICONS[item.id]}</span>
                        <span className="cl-rec-nav-label">{item.label}</span>
                        <span className="cl-rec-nav-menu" aria-hidden>⋮</span>
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
