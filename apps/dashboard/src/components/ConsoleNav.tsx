'use client'

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  firstSubmenuId,
  flattenSubmenu,
  getSubmenuSections,
  isActiveInMenu,
  SERVICE_LABELS,
  type ServiceId,
} from './consoleNavMenus'

export type { ServiceId } from './consoleNavMenus'
export {
  COMPUTE_VM_TABS,
  GATEWAY_TABS,
  LB_TABS,
  SECRET_TABS,
  SQL_INSTANCE_TABS,
  SQL_BACKUP_TABS,
  IAM_PROJECT_TABS,
  isAgentStubTab,
  isApisStubTab,
  isBigQueryStubTab,
  isComputeStubTab,
  isIamStubTab,
  isK8sStubTab,
  isOverviewTab,
  isProductStubTab,
  isSecurityStubTab,
  K8S_DEPLOY_TABS,
  MONITORING_LIVE_TABS,
  RUN_DEPLOY_TABS,
  SECURITY_AUDIT_TABS,
  SQL_GET_STARTED_TABS,
  SERVICE_LABELS,
  SUBMENU_SECTIONS,
} from './consoleNavMenus'

type NavItem = {
  id: ServiceId
  label: string
  icon: ReactNode
  chevron?: boolean
  favoriteable?: boolean
}

const FAV_KEY = 'cl-console-favorites'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const HUB: NavItem[] = [
  {
    id: 'hub',
    label: SERVICE_LABELS.hub,
    chevron: true,
    icon: (
      <Icon>
        <path d="M4 7h16M4 12h10M4 17h16" {...stroke} />
        <circle cx="18" cy="12" r="1.6" fill="currentColor" />
      </Icon>
    ),
  },
  {
    id: 'solutions',
    label: SERVICE_LABELS.solutions,
    chevron: true,
    icon: (
      <Icon>
        <rect x="4" y="4" width="7" height="7" rx="1.2" {...stroke} />
        <rect x="13" y="4" width="7" height="7" rx="1.2" {...stroke} />
        <rect x="4" y="13" width="7" height="7" rx="1.2" {...stroke} />
        <rect x="13" y="13" width="7" height="7" rx="1.2" {...stroke} />
      </Icon>
    ),
  },
]

const PRODUCTS: NavItem[] = [
  {
    id: 'billing',
    label: SERVICE_LABELS.billing,
    favoriteable: true,
    icon: (
      <Icon>
        <rect x="3.5" y="6" width="17" height="12" rx="2" {...stroke} />
        <path d="M3.5 10h17" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'iam',
    label: SERVICE_LABELS.iam,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <path d="M12 3.8 19 7v5.2c0 4.2-2.8 7.2-7 8.5-4.2-1.3-7-4.3-7-8.5V7l7-3.2Z" {...stroke} />
        <circle cx="12" cy="10" r="1.7" {...stroke} />
        <path d="M9.2 15.2c.8-1.2 1.7-1.7 2.8-1.7s2 .5 2.8 1.7" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'marketplace',
    label: SERVICE_LABELS.marketplace,
    favoriteable: true,
    icon: (
      <Icon>
        <path d="M6 8h15l-1.4 8.2H8.2L6 8Z" {...stroke} />
        <path d="M6 8 5 4H3" {...stroke} />
        <circle cx="9" cy="19.2" r="1.2" fill="currentColor" />
        <circle cx="17.5" cy="19.2" r="1.2" fill="currentColor" />
      </Icon>
    ),
  },
  {
    id: 'apis',
    label: SERVICE_LABELS.apis,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor">
          API
        </text>
      </Icon>
    ),
  },
  {
    id: 'gateway',
    label: SERVICE_LABELS.gateway,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <path d="M4 8h16M4 16h16M8 4v16M16 4v16" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'lb',
    label: SERVICE_LABELS.lb,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <path d="M12 4v4M8 12h8M6 16h12M12 20v-4" {...stroke} />
        <circle cx="12" cy="12" r="2.2" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'agent',
    label: SERVICE_LABELS.agent,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <path d="M12 3.5 14.2 9l5.8.4-4.4 3.7 1.4 5.6L12 15.8 6.9 18.7l1.4-5.6L4 9.4 9.8 9 12 3.5Z" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'compute',
    label: SERVICE_LABELS.compute,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <rect x="7" y="7" width="10" height="10" rx="1.4" {...stroke} />
        <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.2 6.2l2 2M15.8 15.8l2 2M17.8 6.2l-2 2M8.2 15.8l-2 2" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'kubernetes',
    label: SERVICE_LABELS.kubernetes,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <path d="M12 3.5 19.5 8v8L12 20.5 4.5 16V8L12 3.5Z" {...stroke} />
        <path d="M9.2 10.2h5.6v5.6H9.2Z" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'storage',
    label: SERVICE_LABELS.storage,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <rect x="4" y="5" width="16" height="6" rx="1.4" {...stroke} />
        <rect x="4" y="13" width="16" height="6" rx="1.4" {...stroke} />
        <circle cx="7.4" cy="8" r="0.9" fill="currentColor" />
        <circle cx="7.4" cy="16" r="0.9" fill="currentColor" />
      </Icon>
    ),
  },
  {
    id: 'security',
    label: SERVICE_LABELS.security,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <path d="M12 3.6 19 7.2v5.4c0 4.4-2.9 7.4-7 8.6-4.1-1.2-7-4.2-7-8.6V7.2L12 3.6Z" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'bigquery',
    label: SERVICE_LABELS.bigquery,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <circle cx="11" cy="11" r="6.2" {...stroke} />
        <path d="M15.6 15.6 20 20" {...stroke} />
        <path d="M8.2 13.2v-2.4M11 13.2V8.6M13.8 13.2v-3.4" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'monitoring',
    label: SERVICE_LABELS.monitoring,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <rect x="3.5" y="5" width="17" height="12" rx="1.6" {...stroke} />
        <path d="M8 21h8M12 17v4" {...stroke} />
        <path d="M6.5 13.2 9.5 10l2.4 2.4 4.8-4.6" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'run',
    label: SERVICE_LABELS.run,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <path d="M5 8.5 10.5 12 5 15.5V8.5Z" {...stroke} />
        <path d="M11 8.5 16.5 12 11 15.5V8.5Z" {...stroke} />
        <path d="M17 8.5 20.5 12 17 15.5" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'vpc',
    label: SERVICE_LABELS.vpc,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <circle cx="7" cy="7" r="2" {...stroke} />
        <circle cx="17" cy="7" r="2" {...stroke} />
        <circle cx="7" cy="17" r="2" {...stroke} />
        <circle cx="17" cy="17" r="2" {...stroke} />
        <path d="M9 7h6M7 9v6M17 9v6M9 17h6" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'databases',
    label: SERVICE_LABELS.databases,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <ellipse cx="12" cy="6.5" rx="7" ry="2.6" {...stroke} />
        <path d="M5 6.5v11c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6v-11" {...stroke} />
        <path d="M5 12c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6" {...stroke} />
      </Icon>
    ),
  },
  {
    id: 'sql',
    label: SERVICE_LABELS.sql,
    favoriteable: true,
    chevron: true,
    icon: (
      <Icon>
        <ellipse cx="12" cy="5.8" rx="7" ry="2.2" {...stroke} />
        <path d="M5 5.8v3.4c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2V5.8" {...stroke} />
        <path d="M5 9.2v3.4c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2V9.2" {...stroke} />
        <path d="M5 12.6v4.2c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2v-4.2" {...stroke} />
      </Icon>
    ),
  },
]

export const PRODUCT_IDS = PRODUCTS.map((p) => p.id)

function readList(key: string): ServiceId[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as ServiceId[]) : []
  } catch {
    return []
  }
}

function getSubmenu(item: NavItem) {
  return flattenSubmenu(item.id)
}

function isActiveItem(active: ServiceId, item: NavItem): boolean {
  return isActiveInMenu(active, item.id)
}

function NavRow({
  item,
  active,
  starred,
  openFlyoutId,
  onFlyoutToggle,
  onSelect,
  onToggleFavorite,
}: {
  item: NavItem
  active: ServiceId
  starred?: boolean
  openFlyoutId: ServiceId | null
  onFlyoutToggle: (id: ServiceId | null) => void
  onSelect: (id: ServiceId) => void
  onToggleFavorite?: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const chevronRef = useRef<HTMLButtonElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const submenuSections = getSubmenuSections(item.id)
  const submenu = getSubmenu(item)
  const hasFlyout = item.chevron && submenu.length > 0
  const rowActive = isActiveItem(active, item)
  const flyoutOpen = openFlyoutId === item.id

  useEffect(() => setMounted(true), [])

  const updateFlyoutPos = () => {
    if (!chevronRef.current) return
    const rect = chevronRef.current.getBoundingClientRect()
    setFlyoutPos({ top: rect.top, left: rect.right + 6 })
  }

  useEffect(() => {
    if (!flyoutOpen) return
    updateFlyoutPos()
    window.addEventListener('resize', updateFlyoutPos)
    window.addEventListener('scroll', updateFlyoutPos, true)
    return () => {
      window.removeEventListener('resize', updateFlyoutPos)
      window.removeEventListener('scroll', updateFlyoutPos, true)
    }
  }, [flyoutOpen])

  useEffect(() => {
    if (!flyoutOpen) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (flyoutRef.current?.contains(target)) return
      onFlyoutToggle(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [flyoutOpen, onFlyoutToggle])

  const toggleFlyout = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (flyoutOpen) {
      onFlyoutToggle(null)
      return
    }
    updateFlyoutPos()
    onFlyoutToggle(item.id)
  }

  const pickSubmenu = (id: ServiceId) => {
    onFlyoutToggle(null)
    onSelect(id)
  }

  const flyout = flyoutOpen && mounted && hasFlyout ? createPortal(
    <div
      ref={flyoutRef}
      className={`cl-gc-flyout cl-gc-flyout-fixed${submenuSections.some((s) => s.title) ? ' is-grouped' : ''}`}
      role="menu"
      style={{ top: flyoutPos.top, left: flyoutPos.left }}
    >
      <p className="cl-gc-flyout-title">{item.label}</p>
      {submenuSections.map((section, index) => (
        <div key={section.title ?? index} className="cl-gc-flyout-section-block">
          {section.title && <p className="cl-gc-flyout-section">{section.title}</p>}
          {section.items.map((sub) => (
            <button
              key={sub.id}
              type="button"
              role="menuitem"
              className={`cl-gc-flyout-item${active === sub.id ? ' is-active' : ''}`}
              onClick={() => pickSubmenu(sub.id)}
            >
              {sub.label}
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  ) : null

  return (
    <div ref={wrapRef} className={`cl-gc-row-wrap${flyoutOpen ? ' is-flyout-open' : ''}`}>
      <div className={`cl-gc-row${rowActive ? ' is-active' : ''}`}>
        <button type="button" className="cl-gc-row-main" onClick={() => onSelect(firstSubmenuId(item.id) ?? item.id)}>
          <span className="cl-gc-row-icon">{item.icon}</span>
          <span className="cl-gc-row-label">{item.label}</span>
        </button>
        {hasFlyout && (
          <button
            ref={chevronRef}
            type="button"
            className={`cl-gc-chevron-btn${flyoutOpen ? ' is-open' : ''}`}
            aria-label={`${item.label} menu`}
            aria-expanded={flyoutOpen}
            aria-haspopup="menu"
            onClick={toggleFlyout}
          >
            <span className="cl-gc-chevron" aria-hidden="true">›</span>
          </button>
        )}
        {item.favoriteable && onToggleFavorite && (
          <button
            type="button"
            className={`cl-gc-star${starred ? ' is-on' : ''}`}
            aria-label={starred ? `Unfavorite ${item.label}` : `Favorite ${item.label}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
          >
            {starred ? '★' : '☆'}
          </button>
        )}
      </div>
      {flyout}
    </div>
  )
}

export default function ConsoleNav({
  active,
  onSelect,
  open,
  onClose,
}: {
  active: ServiceId
  onSelect: (id: ServiceId) => void
  open: boolean
  onClose: () => void
}) {
  const [favorites, setFavorites] = useState<ServiceId[]>([])
  const [showAll, setShowAll] = useState(true)
  const [productFilter, setProductFilter] = useState('')
  const [openFlyoutId, setOpenFlyoutId] = useState<ServiceId | null>(null)

  useEffect(() => {
    setFavorites(readList(FAV_KEY))
  }, [])

  useEffect(() => {
    if (!open) setProductFilter('')
  }, [open])

  const productById = useMemo(
    () => Object.fromEntries(PRODUCTS.map((p) => [p.id, p])) as Record<string, NavItem>,
    [],
  )

  const select = (id: ServiceId) => {
    setOpenFlyoutId(null)
    onSelect(id)
    onClose()
  }

  const toggleFavorite = (id: ServiceId) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      localStorage.setItem(FAV_KEY, JSON.stringify(next))
      return next
    })
  }

  const visibleProducts = showAll ? PRODUCTS : PRODUCTS.filter((p) => ['billing', 'iam', 'marketplace'].includes(p.id))
  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase()
    if (!q) return visibleProducts
    return visibleProducts.filter((p) => p.label.toLowerCase().includes(q))
  }, [visibleProducts, productFilter])
  const favoriteItems = favorites.map((id) => productById[id]).filter(Boolean)

  return (
    <aside className={`cl-gc-nav${open ? ' is-open' : ''}`} aria-label="Console navigation">
      <div className="cl-gc-nav-scroll">
        <div className="cl-gc-nav-section">
          {HUB.map((item) => (
            <NavRow
              key={item.id}
              item={item}
              active={active}
              openFlyoutId={openFlyoutId}
              onFlyoutToggle={setOpenFlyoutId}
              onSelect={select}
            />
          ))}
        </div>

        {favoriteItems.length > 0 && (
          <div className="cl-gc-nav-block">
            <p className="cl-gc-nav-heading">Favorite products</p>
            {favoriteItems.map((item) => (
              <NavRow
                key={`fav-${item.id}`}
                item={item}
                active={active}
                starred
                openFlyoutId={openFlyoutId}
                onFlyoutToggle={setOpenFlyoutId}
                onSelect={select}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
            ))}
          </div>
        )}

        <div className="cl-gc-nav-block" id="cl-gc-products">
          <p className="cl-gc-nav-heading">Products · {visibleProducts.length}</p>
          <label className="cl-gc-nav-search">
            <span className="sr-only">Filter products</span>
            <input
              type="search"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              placeholder="Filter products…"
              aria-label="Filter products"
            />
          </label>
          {filteredProducts.length === 0 ? (
            <p className="cl-gc-nav-empty">No products match &ldquo;{productFilter}&rdquo;</p>
          ) : (
            filteredProducts.map((item) => (
              <NavRow
                key={item.id}
                item={item}
                active={active}
                starred={favorites.includes(item.id)}
                openFlyoutId={openFlyoutId}
                onFlyoutToggle={setOpenFlyoutId}
                onSelect={select}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="cl-gc-nav-foot">
        <button
          type="button"
          className="cl-gc-nav-cta"
          onClick={() => {
            setShowAll(true)
            document.getElementById('cl-gc-products')?.scrollIntoView({ block: 'start' })
          }}
        >
          <span className="cl-gc-row-icon">
            <Icon>
              <rect x="4" y="4" width="7" height="7" rx="1.2" {...stroke} />
              <rect x="13" y="4" width="7" height="7" rx="1.2" {...stroke} />
              <rect x="4" y="13" width="7" height="7" rx="1.2" {...stroke} />
              <rect x="13" y="13" width="7" height="7" rx="1.2" {...stroke} />
            </Icon>
          </span>
          View all products
        </button>
        <button type="button" className="cl-gc-nav-cta" onClick={() => select('agent')}>
          <span className="cl-gc-row-icon">
            <Icon>
              <path d="M8 11V8.5a4 4 0 1 1 8 0V11" {...stroke} />
              <rect x="6" y="11" width="12" height="9" rx="1.6" {...stroke} />
            </Icon>
          </span>
          Get Agent Platform API key
        </button>
      </div>
    </aside>
  )
}
