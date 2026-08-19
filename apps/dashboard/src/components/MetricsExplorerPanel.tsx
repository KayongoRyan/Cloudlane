'use client'

import { useMemo, useState } from 'react'

interface MetricsExplorerPanelProps {
  projectName?: string
  projectSlug?: string
}

const DEFAULT_MQL = (slug: string) =>
  `fetch cloud_run_revision
| metric 'run.googleapis.com/request_count'
| filter resource.project_id == '${slug}'
| group_by 1m, [value_request_count_aggregate: aggregate(value.request_count)]
| every 1m`

export default function MetricsExplorerPanel({ projectName, projectSlug }: MetricsExplorerPanelProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const slug = projectSlug ?? 'default-project'
  const mql = useMemo(() => DEFAULT_MQL(slug), [slug])

  const dates = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']

  return (
    <div className="cl-metrics-explorer cl-mon-explorer">
      <header className="cl-mon-explorer-titlebar">
        <h2>Metrics explorer</h2>
        <div className="cl-mon-explorer-titlebar-actions">
          <button type="button" className="cl-logs-filter">Last 1 hour ▾</button>
          <button type="button" className="cl-logs-run">Run query</button>
        </div>
      </header>

      <div className="cl-logs-toolbar">
        <div className="cl-metrics-query-rows">
          <div className="cl-metrics-query-row">
            <span className="cl-metrics-query-label">Metric</span>
            <button type="button" className="cl-metrics-query-value">
              run.googleapis.com/request_count ▾
            </button>
          </div>
          <div className="cl-metrics-query-row">
            <span className="cl-metrics-query-label">Filter</span>
            <button type="button" className="cl-metrics-query-chip">resource.project_id = {slug}</button>
            <button type="button" className="cl-metrics-query-add">+ Add filter</button>
          </div>
          <div className="cl-metrics-query-row">
            <span className="cl-metrics-query-label">Aggregation</span>
            <button type="button" className="cl-metrics-query-chip">1 minute ▾</button>
            <button type="button" className="cl-metrics-query-chip">Sum ▾</button>
            <button type="button" className="cl-metrics-query-chip">By: None ▾</button>
          </div>
        </div>

        <div className="cl-logs-filters">
          <button type="button" className="cl-logs-filter">All resources ▾</button>
          <button type="button" className="cl-logs-link">Query editor</button>
          <span className="cl-logs-muted">Language: MQL</span>
        </div>
      </div>

      <div className="cl-logs-query-wrap">
        <textarea
          className="cl-logs-query"
          readOnly
          value={mql}
          aria-label="Metrics query"
          rows={4}
        />
      </div>

      <div className="cl-metrics-body">
        <div className="cl-metrics-chart-panel">
          <div className="cl-metrics-view-tabs">
            <button
              type="button"
              className={view === 'chart' ? 'is-active' : ''}
              onClick={() => setView('chart')}
            >
              Chart
            </button>
            <button
              type="button"
              className={view === 'table' ? 'is-active' : ''}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>

          {view === 'chart' ? (
            <>
              <div className="cl-logs-timeline">
                <header>
                  <h3>Chart</h3>
                  <div className="cl-logs-timeline-tools">
                    <button type="button" className="cl-logs-icon-btn" aria-label="Zoom in">+</button>
                    <button type="button" className="cl-logs-icon-btn" aria-label="Zoom out">−</button>
                  </div>
                </header>
                <div className="cl-metrics-chart-area">
                  <div className="cl-metrics-chart-empty">
                    <div className="cl-metrics-chart-icon" aria-hidden>
                      <svg viewBox="0 0 64 48" fill="none">
                        <path d="M4 40 L16 28 L28 32 L40 14 L52 22 L60 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="4" y1="40" x2="60" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                      </svg>
                    </div>
                    <p>No data is available for the selected time frame.</p>
                    {projectName ? (
                      <span className="cl-logs-muted">Project: {projectName}</span>
                    ) : null}
                    <button type="button" className="cl-logs-link">Edit query</button>
                  </div>
                </div>
                <div className="cl-logs-timeline-track">
                  {dates.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="cl-logs-table-wrap">
              <header className="cl-logs-table-head">
                <span>0 time series</span>
                <button type="button" className="cl-logs-filter">Actions ▾</button>
              </header>
              <div className="cl-logs-table-cols cl-metrics-table-cols">
                <span>Metric</span>
                <span>Resource</span>
                <span>Value</span>
              </div>
              <div className="cl-logs-table-empty">
                <div className="cl-logs-table-msg">
                  <span className="cl-logs-severity" aria-hidden>i</span>
                  <p>No metrics matched your query. Deploy a service or adjust filters to see request counts.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="cl-metrics-sidebar">
          <h3>Recommended</h3>
          <ul className="cl-metrics-rec-list">
            <li><button type="button">Request count</button></li>
            <li><button type="button">Request latencies</button></li>
            <li><button type="button">CPU utilization</button></li>
            <li><button type="button">Memory utilization</button></li>
            <li><button type="button">Billable instance time</button></li>
          </ul>
          <h3>Recently viewed</h3>
          <p className="cl-logs-muted">No recently viewed metrics</p>
        </aside>
      </div>
    </div>
  )
}
