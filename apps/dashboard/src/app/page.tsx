'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
    const url = `${apiBase}/api/auth/login`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const text = await res.text()
      const data = text ? JSON.parse(text) : {}

      if (!res.ok) {
        throw new Error(data?.error || text || `Login failed (${res.status})`)
      }

      localStorage.setItem('token', data.token)
      router.push('/dashboard')
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError(`Cannot reach the Cloudlane API at ${apiBase}. Start the API with a valid DATABASE_URL.`)
        return
      }
      setError(err.message || 'Unable to sign in')
    }
  }

  return (
    <main className="auth-page auth-page-cloudlane">
      <section className="auth-panel auth-panel-cloudlane">
        <div className="auth-copy auth-copy-cloudlane">
          <div className="brand-badge brand-badge-cloudlane">CLOUDLANE</div>

          <h1>
            Deploy faster with a
            <br />
            calm, modern control
            <br />
            plane.
          </h1>

          <p className="hero-subtitle">
            Ship new versions in minutes with a polished workspace for managing
            containers, domains, and release health from one view.
          </p>

          <ul className="auth-list auth-list-cloudlane">
            <li>⚡ One-click deployment flow</li>
            <li>🌐 Live URLs for every app</li>
            <li>📈 Clear operational visibility</li>
          </ul>
        </div>

        <div className="auth-card auth-card-cloudlane">
          <div className="card-header cloudlane-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your workspace</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="error-banner cloudlane-error">{error}</div>}

            <div className="form-field cloudlane-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kayongryan@gmail.com"
              />
            </div>

            <div className="form-field cloudlane-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="button-primary cloudlane-button">
              Sign in
            </button>
          </form>

          <p className="auth-footer cloudlane-footer">
            Need an account? <a href="/signup">Create one</a>
          </p>
        </div>
      </section>
    </main>
  )
}
