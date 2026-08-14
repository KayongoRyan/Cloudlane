'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Logo from '../components/Logo'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
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
        setError(`Cannot reach the API at ${apiBase}. Start MongoDB and the API.`)
        return
      }
      setError(err.message || 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-atmosphere" aria-hidden="true" />
      <div className="auth-grid">
        <section className="auth-brand">
          <Logo size="lg" className="auth-logo" />
          <h1 className="auth-headline">
            Deploy a container.
            <span> Get a live URL.</span>
          </h1>
          <p className="auth-lede">
            Scale to zero when idle. Pay only for the seconds you use.
          </p>
        </section>

        <section className="auth-form-panel">
          <div className="auth-form-head">
            <h2>Welcome back</h2>
            <p>Sign in to your workspace</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error" role="alert">{error}</div>}

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="auth-reveal"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            Need an account? <Link href="/signup">Create one</Link>
          </p>
        </section>
      </div>
    </main>
  )
}
