'use client'

import { CSSProperties, FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import Logo from '../../components/Logo'
import { getApiBase } from '../../lib/api'

interface Deployment {
  id: string
  name: string
  image: string
  publicUrl?: string
  subdomain?: string
  status: string
  port: number
  createdAt?: string
}

const apiBase = () => getApiBase()

export default function Dashboard() {
  const router = useRouter()
  const [showDeployForm, setShowDeployForm] = useState(false)
  const [deployData, setDeployData] = useState({ name: '', image: '', port: 8080 })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('nav-lock', navOpen)
    const onResize = () => {
      if (window.innerWidth > 900) setNavOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => {
      document.body.classList.remove('nav-lock')
      window.removeEventListener('resize', onResize)
    }
  }, [navOpen])

  const { mutate } = useSWR<Deployment[]>(
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

  return (
    <div className="gcp-shell">
      <header className={`hero-sky-header${navScrolled ? ' is-scrolled' : ''}${navOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="hero-sky-menu"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <a className="hero-sky-brand" href="/dashboard">
          <Logo size="sm" />
        </a>

        <nav className="hero-sky-nav" aria-label="Main">
          <a href="#overview" onClick={() => setNavOpen(false)}>Overview</a>
          <a href="#products" onClick={() => setNavOpen(false)}>Products</a>
          <a href="#solutions" onClick={() => setNavOpen(false)}>Solutions</a>
          <a href="#credits" onClick={() => setNavOpen(false)}>Pricing</a>
        </nav>

        <div className="hero-sky-actions">
          <button type="button" className="hero-sky-console" onClick={() => { setNavOpen(false); setShowDeployForm(true) }}>
            Console
          </button>
          <button type="button" className="gcp-avatar" onClick={handleLogout} title="Sign out">
            CL
          </button>
        </div>
      </header>

      <section className="hero-sky" id="overview">
        <div className="hero-sky-media" aria-hidden="true" />

        <div className="hero-sky-stage">
          <h1 className="hero-sky-title">
            <span className="hero-sky-title-fill">CLOUDLANE</span>
          </h1>
          <p className="hero-sky-lede">
            Deploy Faster. Scale Smarter. Build Without Limits.
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
            <button type="button" className="hero-sky-ghost" onClick={() => setShowDeployForm(true)}>
              Open console
            </button>
          </div>
        </div>
      </section>

      <main>
        <section className="cl-products" id="products">
          <div className="cl-section-inner">
            <h2 className="cl-section-title">Everything you need to ship a container</h2>
            <div className="cl-product-grid">
              {[
                ['One-command deploys', 'Point at an image. Cloudlane provisions, routes, and publishes it.'],
                ['Instant live URLs', 'Every service gets a public hostname the moment it comes up.'],
                ['Scale to zero', 'Idle replicas sleep. The first request wakes the service.'],
                ['Per-second billing', 'Pay for compute time only. Reserved capacity is not a thing here.'],
                ['Tenant isolation', 'One Kubernetes namespace per tenant. No shared runtime, no noisy neighbors.'],
                ['Cloudlane CLI', 'deploy, logs, and list from the terminal — same loop as the console.'],
                ['Managed ingress', 'TLS and routing without a cluster to babysit or an ingress YAML to write.'],
                ['Live usage', 'Seconds billed, idle windows, and request volume update as they happen.'],
              ].map(([title, body]) => (
                <button
                  key={title}
                  type="button"
                  className="cl-product-card"
                  onClick={() => setShowDeployForm(true)}
                >
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <span className="cl-product-arrow" aria-hidden="true">→</span>
              </button>
              ))}
            </div>
          </div>
        </section>

        <section className="cl-innovate" id="solutions">
          <div className="cl-section-inner">
            <p className="gcp-kicker">Intelligence</p>
            <h2 className="cl-section-title">The control plane thinks with you</h2>
            <div className="cl-innovate-grid">
              {[
                ['Deploy intelligence', 'Health, traffic, and rollout state sit on every release — not in a sidecar dashboard.'],
                ['Wake graph', 'Request patterns train the cold-start window so idle services come back before users wait.'],
                ['Cost envelope', 'Cap spend per service. Runaway replicas stop before the invoice does.'],
                ['Silent idle', 'Zero replicas, still a live URL. The hostname never goes dark just because traffic did.'],
              ].map(([title, body]) => (
                <article key={title} className="cl-innovate-card">
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <span className="cl-product-arrow" aria-hidden="true">→</span>
                </article>
              ))}
            </div>
            <button type="button" className="cl-text-link" onClick={() => setShowDeployForm(true)}>
              Start a deploy
            </button>
          </div>
        </section>

        <section className="cl-boost" id="credits">
          <div className="cl-section-inner cl-boost-layout">
            <div className="cl-boost-visual" aria-hidden="true">
              <div className="cl-boost-frame">
                <div className="cl-boost-panel">
                  <p className="cl-boost-panel-kicker">Idle meter</p>
                  <p className="cl-boost-stat">$0.00</p>
                  <div className="cl-boost-meters">
                    <div><span>Replicas</span><strong>0</strong></div>
                    <div><span>URL</span><strong>live</strong></div>
                  </div>
                  <p className="cl-boost-url">app-x7k2.cloudlane.run</p>
                </div>
              </div>
            </div>
            <div className="cl-boost-copy">
              <h2>Ship the first version on idle time, not a credit card</h2>
              <p>
                From first deploy to first request, Cloudlane stays at zero cost while nothing is running.
                Early teams get a runway of compute seconds to launch; after that you only pay for the
                seconds a replica is actually awake. It is a new way to cloud — no reserved nodes, no
                surprise idle bill.
              </p>
              <button type="button" className="cl-text-link" onClick={() => setShowDeployForm(true)}>
                Claim your runway
              </button>
            </div>
                      </div>
        </section>
      </main>

      <footer className="cl-footer">
        <div className="cl-footer-glow" aria-hidden="true" />
        <div className="cl-section-inner cl-footer-inner">
          <div className="cl-footer-brand">
            <a href="#overview" className="cl-footer-logo" onClick={() => setNavOpen(false)}>
              <Logo size="md" />
            </a>
            <p className="cl-footer-tagline">
              Deploy Faster. Scale Smarter. Build Without Limits.
            </p>
            <button type="button" className="cl-footer-cta" onClick={() => setShowDeployForm(true)}>
              Start a deploy
            </button>
                    </div>

          <div className="cl-footer-cols">
            <div className="cl-footer-col">
              <h3>Products</h3>
              <ul>
                <li><a href="#products">Container deploy</a></li>
                <li><a href="#products">Live URLs</a></li>
                <li><a href="#products">Scale to zero</a></li>
                <li><a href="#credits">Per-second billing</a></li>
                <li><a href="#products">Cloudlane CLI</a></li>
                <li><a href="#products">Managed ingress</a></li>
              </ul>
                    </div>

            <div className="cl-footer-col">
              <h3>Solutions</h3>
              <ul>
                <li><a href="#solutions">API backends</a></li>
                <li><a href="#solutions">Startup runway</a></li>
                <li><a href="#solutions">Staging & previews</a></li>
                <li><a href="#solutions">Cost envelopes</a></li>
                <li><a href="#solutions">Multi-tenant SaaS</a></li>
                <li><a href="#solutions">Wake-on-request workers</a></li>
              </ul>
          </div>

            <div className="cl-footer-col">
              <h3>Resources</h3>
              <ul>
                <li><a href="#overview">What is Cloudlane?</a></li>
                <li><a href="#products">Quickstart</a></li>
                <li><a href="#solutions">Architecture notes</a></li>
                <li><a href="#credits">Pricing model</a></li>
                <li><a href="https://github.com/KayongoRyan/Cloudlane" target="_blank" rel="noreferrer">GitHub</a></li>
                <li><a href="https://comfy-starlight-51c0e7.netlify.app/health" target="_blank" rel="noreferrer">System status</a></li>
              </ul>
            </div>

            <div className="cl-footer-col">
              <h3>Developers</h3>
              <ul>
                <li><button type="button" onClick={() => setShowDeployForm(true)}>Open console</button></li>
                <li><a href="#products">CLI reference</a></li>
                <li><a href="https://comfy-starlight-51c0e7.netlify.app/" target="_blank" rel="noreferrer">Control plane API</a></li>
                <li><a href="https://github.com/KayongoRyan/Cloudlane" target="_blank" rel="noreferrer">Code samples</a></li>
                <li><a href="#solutions">Deploy intelligence</a></li>
                <li><button type="button" onClick={() => setShowDeployForm(true)}>Support</button></li>
              </ul>
            </div>
          </div>

          <div className="cl-footer-base">
            <p className="cl-footer-copy">© {new Date().getFullYear()} Cloudlane. Built for deploy → URL → scale-to-zero.</p>
            <div className="cl-footer-legal">
              <a href="#overview">Privacy</a>
              <a href="#overview">Terms</a>
              <a href="#credits">Pricing</a>
              <span className="cl-footer-status">
                <span className="cl-footer-status-dot" aria-hidden="true" />
                All systems nominal
              </span>
            </div>
          </div>
        </div>
      </footer>

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
