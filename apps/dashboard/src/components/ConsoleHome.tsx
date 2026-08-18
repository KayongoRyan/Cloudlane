'use client'

import { useEffect, useMemo, useState } from 'react'
import { CONSOLE_QUICK_LINKS, CONSOLE_SERVICE_CATEGORIES } from './consoleServiceCategories'
import { SERVICE_LABELS, type ServiceId } from './consoleNavMenus'
import { readRecentlyVisited } from '../lib/recentlyVisited'

function WidgetMenu() {
  return (
    <button type="button" className="cl-aws-widget-menu" aria-label="Widget options">
      ⋮
    </button>
  )
}

function WidgetDrag() {
  return (
    <span className="cl-aws-widget-drag" aria-hidden>
      ⠿
    </span>
  )
}

interface ConsoleHomeProps {
  onOpenService: (id: ServiceId) => void
  healthIssues?: number
  scheduledChanges?: number
  otherNotifications?: number
}

export default function ConsoleHome({
  onOpenService,
  healthIssues = 0,
  scheduledChanges = 0,
  otherNotifications = 0,
}: ConsoleHomeProps) {
  const [categoryId, setCategoryId] = useState(CONSOLE_SERVICE_CATEGORIES[0].id)
  const [recent, setRecent] = useState<ServiceId[]>([])

  useEffect(() => {
    setRecent(readRecentlyVisited())
  }, [])

  const activeCategory = useMemo(
    () => CONSOLE_SERVICE_CATEGORIES.find((c) => c.id === categoryId) ?? CONSOLE_SERVICE_CATEGORIES[0],
    [categoryId],
  )

  const uniqueServices = useMemo(() => {
    const seen = new Set<ServiceId>()
    return activeCategory.services.filter((s) => {
      if (seen.has(s.id)) return false
      seen.add(s.id)
      return true
    })
  }, [activeCategory])

  return (
    <div className="cl-aws-console-home">
      <div className="cl-aws-console-layout">
        <aside className="cl-aws-categories" aria-label="Service categories">
          <ul>
            {CONSOLE_SERVICE_CATEGORIES.map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  className={cat.id === categoryId ? 'is-active' : ''}
                  onClick={() => setCategoryId(cat.id)}
                >
                  {cat.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="cl-aws-console-main">
          <div className="cl-aws-widgets">
            <article className="cl-aws-widget">
              <header className="cl-aws-widget-head">
                <WidgetDrag />
                <div className="cl-aws-widget-title">
                  <h2>Recently visited</h2>
                  <button type="button" className="cl-aws-widget-info">Info</button>
                </div>
                <WidgetMenu />
              </header>
              {recent.length === 0 ? (
                <div className="cl-aws-widget-empty">
                  <div className="cl-aws-widget-cube" aria-hidden />
                  <p className="cl-aws-widget-empty-title">No recently visited services</p>
                  <p className="cl-aws-widget-empty-sub">
                    Explore one of these commonly visited Cloudlane services.
                  </p>
                  <div className="cl-aws-quick-links">
                    {CONSOLE_QUICK_LINKS.map((link) => (
                      <button key={link.id} type="button" onClick={() => onOpenService(link.id)}>
                        {link.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="cl-aws-recent-list">
                  {recent.map((id) => (
                    <li key={id}>
                      <button type="button" onClick={() => onOpenService(id)}>
                        {SERVICE_LABELS[id] ?? id}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="cl-aws-widget">
              <header className="cl-aws-widget-head">
                <WidgetDrag />
                <div className="cl-aws-widget-title">
                  <h2>Cloudlane Health</h2>
                  <button type="button" className="cl-aws-widget-info">Info</button>
                </div>
                <WidgetMenu />
              </header>
              <div className="cl-aws-health-rows">
                <div className="cl-aws-health-row">
                  <span className="cl-aws-health-label">Open issues</span>
                  <div className="cl-aws-health-meta">
                    <strong>{healthIssues}</strong>
                    <span>Past 7 days</span>
                  </div>
                </div>
                <div className="cl-aws-health-row">
                  <span className="cl-aws-health-label">Scheduled changes</span>
                  <div className="cl-aws-health-meta">
                    <strong>{scheduledChanges}</strong>
                    <span>Upcoming and past 7 days</span>
                  </div>
                </div>
                <div className="cl-aws-health-row">
                  <span className="cl-aws-health-label">Other notifications</span>
                  <div className="cl-aws-health-meta">
                    <strong>{otherNotifications}</strong>
                    <span>Past 7 days</span>
                  </div>
                </div>
              </div>
              <footer className="cl-aws-widget-foot">
                <button type="button" className="cl-aws-widget-link" onClick={() => onOpenService('hub-health')}>
                  Go to Cloudlane Health
                </button>
              </footer>
            </article>
          </div>

          <section className="cl-aws-category-panel">
            <header>
              <h2>{activeCategory.label}</h2>
              <p>{uniqueServices.length} service{uniqueServices.length === 1 ? '' : 's'}</p>
            </header>
            <div className="cl-aws-service-grid">
              {uniqueServices.map((svc) => (
                <button
                  key={`${activeCategory.id}-${svc.id}-${svc.label}`}
                  type="button"
                  className="cl-aws-service-card"
                  onClick={() => onOpenService(svc.id)}
                >
                  <strong>{svc.label}</strong>
                  {svc.desc && <span>{svc.desc}</span>}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
