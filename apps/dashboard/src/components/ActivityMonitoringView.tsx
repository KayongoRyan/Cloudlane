'use client'

import { useState } from 'react'
import ActivityShellLayout from './ActivityShellLayout'
import LogsExplorerPanel from './LogsExplorerPanel'
import MetricsExplorerPanel from './MetricsExplorerPanel'
import MonitoringActivityNav, {
  monitoringActivityLabel,
  type MonNavId,
} from './MonitoringActivityNav'
import type { ServiceId } from './consoleNavMenus'

interface Project {
  id: string
  name: string
  slug: string
}

interface ActivityMonitoringViewProps {
  project?: Project
  onOpenService: (id: ServiceId) => void
}

export default function ActivityMonitoringView({ project, onOpenService }: ActivityMonitoringViewProps) {
  const [activityMon, setActivityMon] = useState<MonNavId>('mon-logs-explorer')

  return (
    <ActivityShellLayout
      productLabel="Monitoring"
      activeLabel={monitoringActivityLabel(activityMon)}
      renderNav={(closeNav) => (
        <MonitoringActivityNav
          active={activityMon}
          onSelect={(id) => {
            setActivityMon(id)
            closeNav()
          }}
        />
      )}
    >
      {activityMon === 'mon-logs-explorer' ? (
        <LogsExplorerPanel projectName={project?.name} projectSlug={project?.slug} />
      ) : activityMon === 'mon-metrics-explorer' ? (
        <MetricsExplorerPanel projectName={project?.name} projectSlug={project?.slug} />
      ) : (
        <>
          <header className="cl-activity-main-head">
            <h2>{monitoringActivityLabel(activityMon)}</h2>
            <button
              type="button"
              className="gcp-btn-secondary gcp-btn-compact"
              onClick={() => onOpenService(activityMon)}
            >
              Open in Monitoring
            </button>
          </header>
          <div className="cl-activity-main-body">
            {activityMon === 'mon-system-monitoring' || activityMon === 'mon-overview' ? (
              <p>
                Deployment health, usage metrics, and platform signals for{' '}
                <strong>{project?.name ?? 'your project'}</strong>.
              </p>
            ) : (
              <p>
                {monitoringActivityLabel(activityMon)} is not configured yet for this project.
                Connect logs, metrics, or traces to start exploring data here.
              </p>
            )}
            <div className="cl-activity-quick">
              <button type="button" className="gcp-btn-secondary gcp-btn-compact" onClick={() => onOpenService('iam-audit-logs')}>
                View audit logs
              </button>
              <button type="button" className="gcp-btn-secondary gcp-btn-compact" onClick={() => onOpenService('monitoring')}>
                Monitoring overview
              </button>
            </div>
          </div>
        </>
      )}
    </ActivityShellLayout>
  )
}
