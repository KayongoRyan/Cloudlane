'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'

interface Deployment {
  _id: string
  name: string
  image: string
  subdomain: string
  status: string
  port: number
  createdAt: string
}

export default function Dashboard() {
  const router = useRouter()
  const [showDeployForm, setShowDeployForm] = useState(false)
  const [deployData, setDeployData] = useState({
    name: '',
    image: '',
    port: 8080,
  })
  const [formError, setFormError] = useState('')

  const { data: deployments, mutate } = useSWR<Deployment[]>(
    '/api/deployments',
    async (url: string) => {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/')
        return []
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/')
        }
        throw new Error('Failed to fetch deployments')
      }

      const data = await res.json()
      return data.deployments || []
    }
  )

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const token = localStorage.getItem('token')

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deployments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(deployData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Deployment failed')
      }

      mutate()
      setShowDeployForm(false)
      setDeployData({ name: '', image: '', port: 8080 })
    } catch (err: any) {
      setFormError(err.message)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/')
  }

  const deploymentCount = deployments?.length ?? 0

  return (
    <div className="cloudrun-shell">
      <header className="cloudrun-header">
        <div className="cloudrun-brand">
          <div className="gcloud-logo" aria-label="Google Cloud logo">
            <span className="gcloud-dot blue" />
            <span className="gcloud-dot red" />
            <span className="gcloud-dot yellow" />
            <span className="gcloud-dot green" />
          </div>
          <span className="brand-name">Google Cloud</span>
        </div>

        <nav className="cloudrun-nav" aria-label="Main navigation">
          <a href="#">Overview</a>
          <a href="#">Solutions</a>
          <a href="#">Products</a>
          <a href="#">Pricing</a>
          <a href="#">Resources</a>
        </nav>

        <div className="cloudrun-header-actions">
          <button type="button" className="icon-button" aria-label="Search">
            ⌕
          </button>
          <a href="#">Docs</a>
          <a href="#">Support</a>
          <button type="button" className="console-button">Console</button>
          <button type="button" className="avatar-button" aria-label="Profile">◉</button>
        </div>
      </header>

      <main className="cloudrun-main">
        <section className="cloudrun-hero">
          <div className="cloudrun-copy">
            <h1>Build what&apos;s next. Better software. Faster.</h1>

            <ul className="cloudrun-features">
              <li>✓ Use Google&apos;s core infrastructure, data analytics, and machine learning</li>
              <li>✓ Protect your data and apps with the same security technology Google uses</li>
              <li>✓ Avoid vendor lock-in and run your apps on open source solutions</li>
            </ul>

            <div className="cloudrun-actions">
              <button type="button" className="primary-cta">Contact sales</button>
              <button type="button" className="secondary-cta" onClick={() => setShowDeployForm(true)}>
                Go to my console
              </button>
            </div>
          </div>
        </section>

        <section className="cloudrun-console">
          <div className="panel panel-lg">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Deployments</p>
                <h3>Your Cloudlane applications</h3>
              </div>
              <button
                onClick={() => setShowDeployForm(true)}
                className="button-primary"
              >
                Create deployment
              </button>
            </div>

            <div className="deployments-grid">
              {deployments?.map((deployment) => {
                const normalizedStatus = deployment.status?.toLowerCase() || 'pending'
                const badgeClass =
                  normalizedStatus === 'running'
                    ? 'status-badge status-running'
                    : normalizedStatus === 'stopped'
                      ? 'status-badge status-stopped'
                      : 'status-badge status-pending'

                return (
                  <article key={deployment._id} className="deployment-card">
                    <div className="deployment-top">
                      <div>
                        <h4 className="deployment-title">{deployment.name}</h4>
                        <p className="deployment-image">{deployment.image}</p>
                      </div>
                      <span className={badgeClass}>{normalizedStatus}</span>
                    </div>

                    <a
                      href={`https://${deployment.subdomain}.cloudlane.run`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="deployment-link"
                    >
                      https://{deployment.subdomain}.cloudlane.run
                    </a>

                    <div className="deployment-meta">
                      <span>Port {deployment.port}</span>
                      <span>
                        Created {new Date(deployment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </article>
                )
              })}

              {deploymentCount === 0 && (
                <div className="empty-state">
                  No deployments yet. Launch your first app to see it appear here.
                </div>
              )}
            </div>
          </div>

          <aside className="panel side-panel">
            <div className="side-card">
              <h4>Deployment tips</h4>
              <p>Use versioned image tags to keep releases predictable and easy to roll back.</p>
            </div>
            <div className="side-card">
              <h4>What you can do next</h4>
              <ul>
                <li>Publish a container image</li>
                <li>Attach a custom subdomain</li>
                <li>Share a public URL instantly</li>
              </ul>
            </div>
            <div className="side-card side-card-cta">
              <button type="button" className="button-primary" onClick={() => setShowDeployForm(true)}>
                New deployment
              </button>
              <button type="button" className="button-secondary" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </aside>
        </section>
      </main>

      <button type="button" className="cloudrun-chat" aria-label="Chat support">
        💬
      </button>

      {showDeployForm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h3>Deploy a container</h3>
            <p>Choose a service name, image, and port to launch a new route.</p>

            <form onSubmit={handleDeploy} className="auth-form">
              {formError && <div className="error-banner">{formError}</div>}

              <div className="form-field">
                <label>Name</label>
                <input
                  type="text"
                  required
                  value={deployData.name}
                  onChange={(e) =>
                    setDeployData({ ...deployData, name: e.target.value })
                  }
                  placeholder="my-service"
                />
              </div>

              <div className="form-field">
                <label>Image</label>
                <input
                  type="text"
                  required
                  value={deployData.image}
                  onChange={(e) =>
                    setDeployData({ ...deployData, image: e.target.value })
                  }
                  placeholder="myrepo/app:v1"
                />
              </div>

              <div className="form-field">
                <label>Port</label>
                <input
                  type="number"
                  required
                  value={deployData.port}
                  onChange={(e) =>
                    setDeployData({ ...deployData, port: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeployForm(false)}
                  className="button-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="button-primary">
                  Deploy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
