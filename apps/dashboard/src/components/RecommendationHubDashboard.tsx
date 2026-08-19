'use client'

import { useState } from 'react'

interface RecommendationHubDashboardProps {
  projectName?: string
}

export default function RecommendationHubDashboard({ projectName }: RecommendationHubDashboardProps) {
  const [heroDismissed, setHeroDismissed] = useState(false)
  const project = projectName ?? 'your project'

  return (
    <div className="cl-rec-hub">
      {!heroDismissed && (
        <article className="cl-rec-hero">
          <button
            type="button"
            className="cl-rec-hero-dismiss"
            aria-label="Dismiss"
            onClick={() => setHeroDismissed(true)}
          >
            ×
          </button>
          <div className="cl-rec-hero-icon" aria-hidden>
            <svg viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="1.5" />
              <path d="M32 18a8 8 0 0 0-4 14.9V38h8v-5.1A8 8 0 0 0 32 18Z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M26 42h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="cl-rec-hero-copy">
            <h2>Explore your new Recommendation Hub</h2>
            <p>
              Sort, filter, and view recommendations in folder views. Use categories to focus on cost,
              security, performance, and more across your Cloudlane project.
            </p>
            <div className="cl-rec-hero-actions">
              <button type="button" className="cl-rec-btn-outline">See documentation ↗</button>
              <button type="button" className="cl-rec-text-link">See all recommendations</button>
            </div>
          </div>
        </article>
      )}

      <div className="cl-rec-banner">
        <span className="cl-rec-banner-icon" aria-hidden>i</span>
        <p>
          You are viewing recommendations for project &apos;{project}&apos;. You will only see
          recommendations that you have project level permissions for.
        </p>
        <button type="button" className="cl-rec-banner-link">Learn more ↗</button>
      </div>

      <article className="cl-rec-card">
        <header className="cl-rec-card-head">
          <span className="cl-rec-card-icon cl-rec-card-icon--bulb" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3a5 5 0 0 0-2 9.6V16h4v-3.4A5 5 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.6" /><path d="M9 19h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </span>
          <div>
            <h3>All recommendations</h3>
            <p>Categories help organize your recommendations</p>
          </div>
        </header>
        <div className="cl-rec-table">
          <div className="cl-rec-table-row cl-rec-table-head cl-rec-table-2">
            <span>Category</span>
            <span>Active recommendations</span>
          </div>
          <div className="cl-rec-table-row cl-rec-table-2">
            <span className="cl-rec-table-link">All recommendations</span>
            <span>0</span>
          </div>
        </div>
      </article>

      <article className="cl-rec-card">
        <header className="cl-rec-card-head">
          <span className="cl-rec-card-icon cl-rec-card-icon--cost" aria-hidden>$</span>
          <div>
            <h3>Top ways to save money</h3>
          </div>
        </header>
        <div className="cl-rec-table">
          <div className="cl-rec-table-row cl-rec-table-head cl-rec-table-3">
            <span>Recommendation</span>
            <span>Potential monthly savings</span>
            <span>Active recommendations</span>
          </div>
          <div className="cl-rec-table-empty">No rows to display</div>
        </div>
      </article>

      <div className="cl-rec-grid-2">
        <article className="cl-rec-card">
          <h3 className="cl-rec-card-title">Intelligence centers</h3>
          <ul className="cl-rec-link-list">
            <li><button type="button">FinOps hub</button></li>
            <li><button type="button">Network Intelligence Center</button></li>
            <li><button type="button">IAM</button></li>
          </ul>
        </article>

        <article className="cl-rec-card">
          <header className="cl-rec-card-head cl-rec-card-head--compact">
            <span className="cl-rec-card-icon cl-rec-card-icon--learn" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3 2 8l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M6 11v5c0 2.2 2.7 4 6 4s6-1.8 6-4v-5" stroke="currentColor" strokeWidth="1.6" /></svg>
            </span>
            <h3>Learn</h3>
          </header>
          <ul className="cl-rec-link-list">
            <li><button type="button">What is Active Assist</button></li>
            <li><button type="button">Using recommendations</button></li>
            <li><button type="button">Using the Recommendation Hub</button></li>
            <li><button type="button">Exporting recommendations to BigQuery</button></li>
          </ul>
        </article>
      </div>
    </div>
  )
}
