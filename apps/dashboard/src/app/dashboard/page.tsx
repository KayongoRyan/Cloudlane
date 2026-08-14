'use client'

import { CSSProperties, FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import Logo from '../../components/Logo'

interface Deployment {
  id: string
  name: string
  image: string
  subdomain: string
  status: string
  port: number
  createdAt?: string
}

const apiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

export default function Dashboard() {
  const router = useRouter()
  const [showDeployForm, setShowDeployForm] = useState(false)
  const [deployData, setDeployData] = useState({ name: '', image: '', port: 8080 })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const { data: deployments, mutate, isLoading } = useSWR<Deployment[]>(
    'deployments',
    async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/')
        return []
      }

      const res = await fetch(`${apiBase()}/api/deployments`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        if (res.status === 401) router.push('/')
        throw new Error('Failed to fetch deployments')
      }

      const data = await res.json()
      return data.deployments || []
    }
  )

  const handleDeploy = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)
    const token = localStorage.getItem('token')

    try {
      const res = await fetch(`${apiBase()}/api/deployments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(deployData),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Deployment failed')
      }

      await mutate()
      setShowDeployForm(false)
      setDeployData({ name: '', image: '', port: 8080 })
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/')
  }

  const scrollToConsole = () => {
    document.getElementById('console')?.scrollIntoView({ behavior: 'smooth' })
  }

  const count = deployments?.length ?? 0

  return (
    <div className="gcp-shell">
      <section className="hero-sky" id="overview">
        <div className="hero-sky-media" aria-hidden="true" />

        <header className={`hero-sky-header${navScrolled ? ' is-scrolled' : ''}`}>
          <a className="hero-sky-brand" href="/dashboard">
            <Logo size="sm" />
          </a>

          <nav className="hero-sky-nav" aria-label="Main">
            <a href="#overview">Overview</a>
            <a href="#console">Deployments</a>
            <a href="#console">Pricing</a>
            <a href="#console">Docs</a>
          </nav>

          <div className="hero-sky-actions">
            <button type="button" className="hero-sky-console" onClick={scrollToConsole}>
              Console
            </button>
            <button type="button" className="gcp-avatar" onClick={handleLogout} title="Sign out">
              CL
            </button>
          </div>
        </header>

        <div className="hero-sky-stage">
          <h1 className="hero-sky-title">
            <span className="hero-sky-title-fill">CLOUDLANE</span>
          </h1>
          <p className="hero-sky-lede">
            Deploy in seconds. Live URL instantly. Pay per use.
          </p>

          <div className="hero-showcase" aria-hidden="true">
            <div className="hero-showcase-scene">
              <div className="hero-showcase-track">
                <article className="hero-card hero-card--cli" style={{ '--offset': -2 } as CSSProperties}>
                  <p className="hero-card-kicker">CLI</p>
                  <pre>{`$ cloudlane deploy\n  --image app:v1`}</pre>
                  <span className="hero-card-foot">One command</span>
                </article>

                <article className="hero-card hero-card--url" style={{ '--offset': -1 } as CSSProperties}>
                  <p className="hero-card-kicker">Live URL</p>
                  <p className="hero-card-url">app-x7k2.cloudlane.run</p>
                  <div className="hero-card-bar"><span style={{ width: '78%' }} /></div>
                  <span className="hero-card-foot">Published instantly</span>
                </article>

                <article className="hero-card hero-card--center" style={{ '--offset': 0 } as CSSProperties}>
                  <p className="hero-card-kicker">Control plane</p>
                  <h3>Intelligence in every deploy</h3>
                  <svg className="hero-card-chart" viewBox="0 0 160 64" fill="none">
                    <path d="M4 48 C28 46 36 20 56 28 C76 36 88 12 108 18 C128 24 140 8 156 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    <path d="M4 48 C28 46 36 20 56 28 C76 36 88 12 108 18 C128 24 140 8 156 10 V64 H4 Z" fill="currentColor" opacity="0.12" />
                  </svg>
                  <span className="hero-card-foot">Healthy · running</span>
                </article>

                <article className="hero-card hero-card--bill" style={{ '--offset': 1 } as CSSProperties}>
                  <p className="hero-card-kicker">Usage</p>
                  <p className="hero-card-stat">$0.12<span>/hr</span></p>
                  <ul>
                    <li><span>Compute</span><b>42s</b></li>
                    <li><span>Idle</span><b>$0</b></li>
                  </ul>
                  <span className="hero-card-foot">Pay per second</span>
                </article>

                <article className="hero-card hero-card--scale" style={{ '--offset': 2 } as CSSProperties}>
                  <p className="hero-card-kicker">Scale to zero</p>
                  <div className="hero-card-meters">
                    <div><span>Idle</span><strong>0</strong></div>
                    <div><span>Peak</span><strong>N</strong></div>
                  </div>
                  <span className="hero-card-foot">Wake on request</span>
                </article>
              </div>
            </div>
            <div className="hero-showcase-rating">
              <p>Built for deploy → URL → scale-to-zero</p>
              <div className="hero-showcase-stars" aria-hidden="true">
                <span /><span /><span /><span /><span />
              </div>
            </div>
          </div>

          <div className="hero-sky-ctas">
            <button type="button" className="gcp-btn-primary" onClick={() => setShowDeployForm(true)}>
              Deploy now
            </button>
            <button type="button" className="hero-sky-ghost" onClick={scrollToConsole}>
              Open console
            </button>
          </div>
        </div>
      </section>

      <main>
        <section className="gcp-console" id="console">
          <div className="gcp-console-inner">
            <div className="gcp-console-head">
              <div>
                <p className="gcp-kicker">Console</p>
                <h2>Your deployments</h2>
              </div>
              <button type="button" className="gcp-btn-primary gcp-btn-compact" onClick={() => setShowDeployForm(true)}>
                Create deployment
              </button>
            </div>

            <div className="gcp-table">
              <div className="gcp-table-row gcp-table-head">
                <span>Service</span>
                <span>Image</span>
                <span>URL</span>
                <span>Status</span>
              </div>

              {isLoading && <div className="gcp-empty">Loading deployments…</div>}

              {!isLoading && count === 0 && (
                <div className="gcp-empty">
                  No deployments yet. Create one to get a public URL.
                </div>
              )}

              {deployments?.map((d) => {
                const status = (d.status || 'pending').toLowerCase()
                return (
                  <div className="gcp-table-row" key={d.id}>
                    <span className="gcp-service">{d.name}</span>
                    <span className="gcp-mono">{d.image}</span>
                    <a
                      className="gcp-link"
                      href={`https://${d.subdomain}.cloudlane.run`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {d.subdomain}.cloudlane.run
                    </a>
                    <span className={`gcp-status gcp-status-${status}`}>{status}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      <button type="button" className="gcp-chat" aria-label="Support chat" onClick={() => setShowDeployForm(true)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4 4v-4.5A2.5 2.5 0 0 1 4 13.5v-7Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {showDeployForm && (
        <div className="gcp-modal-overlay" role="dialog" aria-modal="true">
          <div className="gcp-modal">
            <h3>Deploy a container</h3>
            <p>Name the service, point at an image, pick a port.</p>

            <form onSubmit={handleDeploy} className="gcp-form">
              {formError && <div className="gcp-form-error">{formError}</div>}

              <label>
                <span>Name</span>
                <input
                  required
                  value={deployData.name}
                  onChange={(e) => setDeployData({ ...deployData, name: e.target.value })}
                  placeholder="my-service"
                />
              </label>

              <label>
                <span>Image</span>
                <input
                  required
                  value={deployData.image}
                  onChange={(e) => setDeployData({ ...deployData, image: e.target.value })}
                  placeholder="myrepo/app:v1"
                />
              </label>

              <label>
                <span>Port</span>
                <input
                  type="number"
                  required
                  value={deployData.port}
                  onChange={(e) => setDeployData({ ...deployData, port: parseInt(e.target.value, 10) || 8080 })}
                />
              </label>

              <div className="gcp-modal-actions">
                <button type="button" className="gcp-btn-secondary" onClick={() => setShowDeployForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="gcp-btn-primary gcp-btn-compact" disabled={submitting}>
                  {submitting ? 'Deploying…' : 'Deploy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
