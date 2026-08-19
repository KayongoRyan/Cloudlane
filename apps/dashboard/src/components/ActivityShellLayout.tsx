'use client'

import { ReactNode, useState } from 'react'

interface ActivityShellLayoutProps {
  productLabel: string
  activeLabel: string
  renderNav: (closeNav: () => void) => ReactNode
  children: ReactNode
}

export default function ActivityShellLayout({
  productLabel,
  activeLabel,
  renderNav,
  children,
}: ActivityShellLayoutProps) {
  const [navOpen, setNavOpen] = useState(false)
  const closeNav = () => setNavOpen(false)

  return (
    <div className={`cl-activity-shell${navOpen ? ' is-nav-drawer-open' : ''}`}>
      <div className="cl-activity-mobile-bar">
        <button
          type="button"
          className="cl-activity-mobile-toggle"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          <span className="cl-activity-mobile-toggle-icon" aria-hidden>☰</span>
          <span className="cl-activity-mobile-toggle-label">{activeLabel}</span>
        </button>
        <span className="cl-activity-mobile-context">{productLabel}</span>
      </div>

      {navOpen && (
        <button
          type="button"
          className="cl-activity-nav-scrim"
          aria-label="Close navigation"
          onClick={closeNav}
        />
      )}

      <aside className="cl-activity-nav-aside">{renderNav(closeNav)}</aside>

      <div className="cl-activity-main">{children}</div>
    </div>
  )
}
