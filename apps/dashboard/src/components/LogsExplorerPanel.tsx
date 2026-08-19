'use client'

import { useMemo, useState } from 'react'

interface LogsExplorerPanelProps {
  projectName?: string
  projectSlug?: string
}

const DEFAULT_QUERY = (slug: string) =>
  `(logName = "projects/${slug}/logs/cloudaudit.cloudlane.com%2Factivity" OR logName = "projects/${slug}/logs/cloudaudit.cloudlane.com%2Fdata_access" OR labels.activity_type_name:*)`

export default function LogsExplorerPanel({ projectName, projectSlug }: LogsExplorerPanelProps) {
  const [showQuery, setShowQuery] = useState(true)
  const slug = projectSlug ?? 'default-project'
  const query = useMemo(() => DEFAULT_QUERY(slug), [slug])

  const dates = ['08-12', '08-13', '08-14', '08-15', '08-16', '08-17', '08-18', '08-19']

  return (
    <div className="cl-logs-explorer cl-mon-explorer">
      <div className="cl-logs-toolbar">
        <div className="cl-logs-toolbar-row">
          <select className="cl-logs-select" aria-label="Project logs" defaultValue="project">
            <option value="project">Project logs</option>
          </select>
          <input
            className="cl-logs-search"
            type="search"
            placeholder="Search all fields"
            aria-label="Search all fields"
          />
          <div className="cl-logs-toolbar-actions">
            <button type="button" className="cl-logs-icon-btn" aria-label="Clear query">⌫</button>
            <button type="button" className="cl-logs-icon-btn" aria-label="Save query">⎙</button>
            <button type="button" className="cl-logs-run">Run query</button>
          </div>
        </div>

        <div className="cl-logs-filters">
          <button type="button" className="cl-logs-filter">All resources ▾</button>
          <button type="button" className="cl-logs-filter">All log names ▾</button>
          <button type="button" className="cl-logs-filter">All severities ▾</button>
          <button type="button" className="cl-logs-filter">Correlate by ▾</button>
          <button type="button" className="cl-logs-filter">+1 filter</button>
          <label className="cl-logs-toggle">
            <input
              type="checkbox"
              checked={showQuery}
              onChange={(e) => setShowQuery(e.target.checked)}
            />
            <span>Show query</span>
          </label>
        </div>
      </div>

      {showQuery && (
        <div className="cl-logs-query-wrap">
          <textarea
            className="cl-logs-query"
            readOnly
            value={query}
            aria-label="Log query"
            rows={3}
          />
          <div className="cl-logs-query-foot">
            <span>
              <button type="button" className="cl-logs-link">Example queries</button>
              {' · '}
              <button type="button" className="cl-logs-link">Query language guide</button>
            </span>
            <span className="cl-logs-muted">Language: LQL</span>
          </div>
        </div>
      )}

      <div className="cl-logs-body">
        <aside className="cl-logs-fields">
          <h3>Fields</h3>
          <div className="cl-logs-fields-empty">
            <div className="cl-logs-fields-icon" aria-hidden>
              <svg viewBox="0 0 48 48" fill="none">
                <rect x="8" y="10" width="32" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M14 18h20M14 24h14M14 30h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p>No data found</p>
            <button type="button" className="cl-logs-link">Re-run query</button>
          </div>
        </aside>

        <div className="cl-logs-results">
          <section className="cl-logs-timeline">
            <header>
              <h3>Timeline</h3>
              <div className="cl-logs-timeline-tools">
                <button type="button" className="cl-logs-icon-btn" aria-label="Zoom in">+</button>
                <button type="button" className="cl-logs-icon-btn" aria-label="Zoom out">−</button>
                <button type="button" className="cl-logs-icon-btn" aria-label="Collapse timeline">⌃</button>
              </div>
            </header>
            <div className="cl-logs-timeline-track">
              {dates.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          </section>

          <section className="cl-logs-table-wrap">
            <header className="cl-logs-table-head">
              <span>0 results</span>
              <button type="button" className="cl-logs-filter">Actions ▾</button>
            </header>
            <div className="cl-logs-table-scroll">
              <div className="cl-logs-table-cols">
                <span>Severity</span>
                <span>Time</span>
                <span>Summary</span>
              </div>
              <div className="cl-logs-table-empty">
                <div className="cl-logs-table-msg">
                  <span className="cl-logs-severity" aria-hidden>i</span>
                  <p>
                    Showing logs for last 7 days from 8/12/26, 2:41 PM to 8/19/26, 2:41 PM.
                    {projectName ? ` Project: ${projectName}.` : ''}
                  </p>
                </div>
                <div className="cl-logs-table-actions">
                  <button type="button" className="cl-logs-chip">Extend time by: 1 day ▾</button>
                  <button type="button" className="cl-logs-chip">Edit time</button>
                </div>
                <div className="cl-logs-table-msg">
                  <span className="cl-logs-severity" aria-hidden>i</span>
                  <p>
                    Showing logs for last 7 days from 8/12/26, 2:41 PM to 8/19/26, 2:41 PM.
                  </p>
                </div>
                <div className="cl-logs-table-actions">
                  <button type="button" className="cl-logs-chip">Extend time by: 1 day ▾</button>
                  <button type="button" className="cl-logs-chip">Edit time</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
