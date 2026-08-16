'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Logo from '../components/Logo'
import { getApiBase, apiReachabilityHint } from '../lib/api'
import { apiFetch } from '../lib/apiFetch'

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

    const apiBase = getApiBase()

    try {
      const res = await apiFetch('/api/auth/login', {
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
      if (data.apiKey) localStorage.setItem('apiKey', data.apiKey)
      router.push('/dashboard')
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError(`Cannot reach the API at ${apiBase}. ${apiReachabilityHint(apiBase)}`)
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
            <span className="auth-headline-line">Deploy Faster.</span>
            <span className="auth-headline-line auth-headline-muted">Scale Smarter.</span>
          </h1>
          <p className="auth-lede">
            Build Without Limits.
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
