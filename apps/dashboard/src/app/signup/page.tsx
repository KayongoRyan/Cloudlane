'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Logo from '../../components/Logo'
import { getApiBase, apiReachabilityHint } from '../../lib/api'
import { apiFetch } from '../../lib/apiFetch'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organization, setOrganization] = useState('')
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
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, organization }),
      })

      const text = await res.text()
      let data: any = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        data = { error: text }
      }

      if (!res.ok) {
        throw new Error(data.error || text || `Signup failed (${res.status})`)
      }

      localStorage.setItem('token', data.token)
      router.push('/dashboard')
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError(`Cannot reach the API at ${apiBase}. ${apiReachabilityHint(apiBase)}`)
        return
      }
      setError(err.message || 'Unable to create account')
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
            <span className="auth-headline-line">Your first deploy</span>
            <span className="auth-headline-line auth-headline-muted">in minutes.</span>
          </h1>
          <p className="auth-lede">
            Create a workspace, ship a container, and publish a live URL —
            without touching clusters.
          </p>
        </section>

        <section className="auth-form-panel">
          <div className="auth-form-head">
            <h2>Create an account</h2>
            <p>Start managing services on Cloudlane</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error" role="alert">{error}</div>}

            <label className="auth-field">
              <span>Organization</span>
              <input
                type="text"
                name="organization"
                required
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Acme Labs"
              />
            </label>

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
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link href="/">Sign in</Link>
          </p>
        </section>
      </div>
    </main>
  )
}
