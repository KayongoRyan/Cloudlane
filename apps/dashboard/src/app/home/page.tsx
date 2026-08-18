'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import ConsoleNav, { type ServiceId } from '../../components/ConsoleNav'
import HomeDashboard from '../../components/HomeDashboard'
import Logo from '../../components/Logo'
import { getApiBase } from '../../lib/api'
import { useConsoleShell } from '../../lib/useConsoleShell'

interface Project {
  id: string
  name: string
  slug: string
}

export default function HomePage() {
  const router = useRouter()
  const topbarRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) router.push('/')
  }, [router])

  useEffect(() => {
    fetch(`${getApiBase()}/health`)
      .then((r) => setApiHealthy(r.ok))
      .catch(() => setApiHealthy(false))
  }, [])

  useConsoleShell(navOpen, topbarRef)

  const fetcher = useCallback(async <T,>(path: string): Promise<T> => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${getApiBase()}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) {
      router.push('/')
      throw new Error('unauthorized')
    }
    if (!res.ok) throw new Error('Request failed')
    return res.json() as Promise<T>
  }, [router])

  const { data: projectsData } = useSWR('home-projects', () => fetcher<{ projects: Project[] }>('/api/projects'))
  const projects = projectsData?.projects ?? []

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id)
  }, [projects, projectId])

  const activeProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? projects[0],
    [projects, projectId],
  )

  const openService = (id: ServiceId) => {
    setNavOpen(false)
    if (id === 'hub-home' || id === 'hub') {
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    router.push(`/dashboard/console?tab=${id}`)
  }

  return (
    <div className={`gcp-shell cl-console-shell cl-gc-app${navOpen ? ' is-nav-open' : ''}`}>
      {navOpen && (
        <button type="button" className="cl-gc-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
      )}

      <header ref={topbarRef} className="cl-console-top">
        <button
          type="button"
          className={`cl-gc-menu${navOpen ? ' is-open' : ''}`}
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
        <a href="/dashboard" className="hero-sky-brand">
          <Logo size="sm" />
        </a>
        <div className="cl-console-project">
          <span>Project</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Active project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="gcp-btn-secondary gcp-btn-compact"
          onClick={() => router.push('/dashboard')}
        >
          Overview
        </button>
        <button
          type="button"
          className="gcp-btn-secondary gcp-btn-compact"
          onClick={() => { localStorage.removeItem('token'); router.push('/') }}
        >
          Sign out
        </button>
      </header>

      <ConsoleNav active="hub-home" onSelect={openService} open={navOpen} onClose={() => setNavOpen(false)} />

      <div ref={mainRef} className="cl-gc-main">
        <section className="gcp-console cl-home-shell">
          <HomeDashboard project={activeProject} apiHealthy={apiHealthy} onOpenService={openService} />
        </section>
      </div>
    </div>
  )
}
