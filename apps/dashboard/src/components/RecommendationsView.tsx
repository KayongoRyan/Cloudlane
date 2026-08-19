'use client'

import { useState } from 'react'
import ActivityShellLayout from './ActivityShellLayout'
import RecommendationActivityNav from './RecommendationActivityNav'
import RecommendationHubDashboard from './RecommendationHubDashboard'
import {
  REC_CATEGORY_DESCRIPTIONS,
  RECOMMENDATION_LABELS,
  type RecNavId,
} from './recommendationNav'
import type { ServiceId } from './consoleNavMenus'

interface Project {
  id: string
  name: string
  slug: string
}

interface RecommendationsViewProps {
  project?: Project
  onOpenService: (id: ServiceId) => void
}

export default function RecommendationsView({ project, onOpenService }: RecommendationsViewProps) {
  const [active, setActive] = useState<RecNavId>('rec-dashboard')

  return (
    <ActivityShellLayout
      productLabel="Active Assist"
      activeLabel={RECOMMENDATION_LABELS[active]}
      renderNav={(closeNav) => (
        <RecommendationActivityNav
          active={active}
          onSelect={(id) => {
            setActive(id)
            closeNav()
          }}
        />
      )}
    >
      <div className="cl-rec-main">
        {active === 'rec-dashboard' ? (
          <RecommendationHubDashboard projectName={project?.name} />
        ) : (
          <div className="cl-rec-category">
            <header className="cl-rec-category-head">
              <h2>{RECOMMENDATION_LABELS[active]}</h2>
              <button
                type="button"
                className="gcp-btn-secondary gcp-btn-compact"
                onClick={() => onOpenService('hub-optimization')}
              >
                Open optimization hub
              </button>
            </header>
            {REC_CATEGORY_DESCRIPTIONS[active] && (
              <p className="cl-rec-category-desc">{REC_CATEGORY_DESCRIPTIONS[active]}</p>
            )}
            <article className="cl-rec-card">
              <div className="cl-rec-table">
                <div className="cl-rec-table-row cl-rec-table-head cl-rec-table-3">
                  <span>Recommendation</span>
                  <span>Impact</span>
                  <span>Status</span>
                </div>
                <div className="cl-rec-table-empty">No recommendations in this category yet</div>
              </div>
            </article>
          </div>
        )}
      </div>
    </ActivityShellLayout>
  )
}
