'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'

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
      <header className="gcp-header">
        <a className="gcp-brand" href="/dashboard">
          <span className="gcp-mark" aria-hidden="true" />
          <span className="gcp-brand-text">Cloudlane</span>
        </a>

        <nav className="gcp-nav" aria-label="Main">
          <a href="#overview">Overview</a>
          <a href="#console">Deployments</a>
          <a href="#console">Pricing</a>
          <a href="#console">Docs</a>
        </nav>

        <div className="gcp-header-actions">
          <a href="#console">Support</a>
          <button type="button" className="gcp-console-btn" onClick={scrollToConsole}>
            Console
          </button>
          <button type="button" className="gcp-avatar" onClick={handleLogout} title="Sign out">
            CL
          </button>
        </div>
      </header>

      <main>
        <section className="gcp-hero" id="overview">
          <div className="gcp-hero-inner">
            <h1 className="gcp-headline">
              Build what&apos;s next.
              <br />
              Better software. Faster.
            </h1>

            <ul className="gcp-benefits">
              <li>Deploy a container and get a live URL in one command</li>
              <li>Scale to zero when idle — pay only for the seconds you use</li>
              <li>Stay clear of cluster complexity with a Cloud Run–simple control plane</li>
            </ul>

            <div className="gcp-ctas">
              <button type="button" className="gcp-btn-primary" onClick={() => setShowDeployForm(true)}>
                Deploy now
              </button>
              <button type="button" className="gcp-btn-secondary" onClick={scrollToConsole}>
                Go to my console
              </button>
            </div>
          </div>
        </section>

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
