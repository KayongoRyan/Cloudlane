'use client'

import { forwardRef, ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import CloudlaneTerminal from './CloudlaneTerminal'
import Logo from './Logo'

interface Project {
  id: string
  name: string
}

interface ConsoleTopBarProps {
  showMenu?: boolean
  navOpen?: boolean
  onMenuToggle?: () => void
  projectId: string
  projects: Project[]
  onProjectChange: (id: string) => void
  actions?: ReactNode
  profileInitials?: string
}

export const ConsoleTopBar = forwardRef<HTMLElement, ConsoleTopBarProps>(function ConsoleTopBar(
  {
    showMenu = false,
    navOpen = false,
    onMenuToggle,
    projectId,
    projects,
    onProjectChange,
    actions,
    profileInitials = 'CL',
  },
  ref,
) {
  const router = useRouter()
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const activeProject = projects.find((p) => p.id === projectId) ?? projects[0]

  useEffect(() => {
    if (!profileOpen) return
    const close = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [profileOpen])

  const signOut = () => {
    localStorage.removeItem('token')
    router.push('/')
  }

  return (
    <>
      <header ref={ref} className="cl-console-top">
        {showMenu && (
          <button
            type="button"
            className={`cl-gc-menu${navOpen ? ' is-open' : ''}`}
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
            onClick={onMenuToggle}
          >
            <span /><span /><span />
          </button>
        )}
        <a href="/home" className="hero-sky-brand">
          <Logo size="sm" />
        </a>
        <div className="cl-console-project">
          <span>Project</span>
          <select
            value={projectId}
            onChange={(e) => onProjectChange(e.target.value)}
            aria-label="Active project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="cl-console-top-actions">
          {actions}
          <button
            type="button"
            className="cl-console-terminal-btn"
            aria-label="Open Cloudlane terminal"
            title="Cloudlane terminal"
            onClick={() => setTerminalOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M7 9l3 3-3 3M12 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="cl-console-profile" ref={profileRef}>
            <button
              type="button"
              className="cl-console-avatar"
              aria-label="Account menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((v) => !v)}
            >
              <span aria-hidden>{profileInitials}</span>
            </button>
            {profileOpen && (
              <div className="cl-console-profile-menu" role="menu">
                <p className="cl-console-profile-name">{activeProject?.name ?? 'Cloudlane'}</p>
                <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); router.push('/home') }}>
                  Home
                </button>
                <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); router.push('/dashboard') }}>
                  Overview
                </button>
                <button type="button" role="menuitem" className="is-danger" onClick={signOut}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <CloudlaneTerminal
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        projectId={projectId}
        projectName={activeProject?.name}
      />
    </>
  )
})
