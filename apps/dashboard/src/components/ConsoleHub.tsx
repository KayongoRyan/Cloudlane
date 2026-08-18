'use client'

import { useEffect, useState } from 'react'
import {
  CONSOLE_QUICK_CATEGORIES,
  CONSOLE_SERVICE_CATEGORIES,
  type CatalogService,
} from './consoleServiceCategories'
import {
  pushRecentService,
  readRecentServices,
  recentServiceLabels,
} from './recentServices'
import type { ServiceId } from './consoleNavMenus'

interface ConsoleHubProps {
  failedDeployments?: number
  apiHealthy?: boolean | null
  onOpenService: (id: ServiceId) => void
}

function WidgetMenu() {
  return (
    <button type="button" className="cl-hub-widget-menu" aria-label="Widget options">
      ⋮
    </button>
  )
}

function WidgetDrag() {
  return (
    <span className="cl-hub-widget-drag" aria-hidden>
      <span /><span /><span /><span /><span /><span />
    </span>
  )
}

export default function ConsoleHub({ failedDeployments = 0, apiHealthy, onOpenService }: ConsoleHubProps) {
  const [recent, setRecent] = useState<{ id: ServiceId; label: string }[]>([])

  useEffect(() => {
    setRecent(recentServiceLabels(readRecentServices()))
  }, [])

  const open = (id: ServiceId) => {
    pushRecentService(id)
    setRecent(recentServiceLabels(readRecentServices()))
    onOpenService(id)
  }

  const openCatalog = (service: CatalogService) => {
    if (service.consoleId) open(service.consoleId)
  }

  const openIssues = failedDeployments + (apiHealthy === false ? 1 : 0)

  return (
    <div className="cl-hub">
      <div className="cl-hub-widgets-row">
        <article className="cl-hub-widget cl-hub-widget--wide">
          <header className="cl-hub-widget-head">
            <WidgetDrag />
            <h2>
              Recently visited
              <button type="button" className="cl-hub-info">Info</button>
            </h2>
            <WidgetMenu />
          </header>
          {recent.length === 0 ? (
            <div className="cl-hub-empty">
              <div className="cl-hub-empty-icon" aria-hidden>
                <svg viewBox="0 0 48 48" fill="none">
                  <path d="M10 34 24 10l14 24H10Z" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <p className="cl-hub-empty-title">No recently visited services</p>
              <p className="cl-hub-empty-sub">Browse a service category below to get started.</p>
              <div className="cl-hub-quick-links">
                {CONSOLE_QUICK_CATEGORIES.map((name) => (
                  <span key={name} className="cl-hub-quick-tag">{name}</span>
                ))}
              </div>
            </div>
          ) : (
            <ul className="cl-hub-recent-list">
              {recent.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => open(s.id)}>{s.label}</button>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="cl-hub-widget">
          <header className="cl-hub-widget-head">
            <WidgetDrag />
            <h2>
              Cloudlane Health
              <button type="button" className="cl-hub-info">Info</button>
            </h2>
            <WidgetMenu />
          </header>
          <div className="cl-hub-health-rows">
            <div className="cl-hub-health-row">
              <span>Open issues</span>
              <strong>{openIssues}</strong>
              <em>Past 7 days</em>
            </div>
            <div className="cl-hub-health-row">
              <span>Scheduled changes</span>
              <strong>0</strong>
              <em>Upcoming and past 7 days</em>
            </div>
            <div className="cl-hub-health-row">
              <span>Other notifications</span>
              <strong>{apiHealthy === false ? 1 : 0}</strong>
              <em>Past 7 days</em>
            </div>
          </div>
          <footer className="cl-hub-widget-foot">
            <button type="button" className="cl-hub-foot-link" onClick={() => open('hub-health')}>
              Go to Cloudlane Health
            </button>
          </footer>
        </article>
      </div>

      <section className="cl-hub-categories">
        <h2 className="cl-hub-categories-title">Services</h2>
        <div className="cl-hub-category-grid">
          {CONSOLE_SERVICE_CATEGORIES.map((category) => (
            <CategoryCard
              key={category.title}
              title={category.title}
              services={category.services}
              onOpen={openCatalog}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function CategoryCard({
  title,
  services,
  onOpen,
}: {
  title: string
  services: CatalogService[]
  onOpen: (service: CatalogService) => void
}) {
  return (
    <article className="cl-hub-category-card">
      <header className="cl-hub-widget-head">
        <WidgetDrag />
        <h3>{title}</h3>
        <WidgetMenu />
      </header>
      {services.length === 0 ? (
        <p className="cl-hub-category-empty">No services in this category yet</p>
      ) : (
        <ul className="cl-hub-catalog-list">
          {services.map((service) => (
            <li key={service.name}>
              {service.consoleId ? (
                <button type="button" className="cl-hub-catalog-item" onClick={() => onOpen(service)}>
                  <strong>{service.name}</strong>
                  <span>{service.description}</span>
                </button>
              ) : (
                <div className="cl-hub-catalog-item cl-hub-catalog-item--static">
                  <strong>{service.name}</strong>
                  <span>{service.description}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
