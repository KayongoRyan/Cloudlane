'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [organization, setOrganization] = useState('')
    const [error, setError] = useState('')
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

        try {
            const url = `${apiBase}/api/auth/register`

            const res = await fetch(url, {
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
                setError(`Cannot reach the Cloudlane API at ${apiBase}. Start the API with a valid DATABASE_URL.`)
                return
            }
            setError(err.message || 'Unable to create account')
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-panel">
                <div className="auth-copy">
                    <span className="brand-badge">Cloudlane</span>
                    <h1>Start your first deployment in minutes.</h1>
                    <p>
                        Create a workspace, add your first container, and publish a live URL
                        with one smooth onboarding experience.
                    </p>
                    <ul className="auth-list">
                        <li>⚡ Fast project setup</li>
                        <li>🔐 Secure authentication</li>
                        <li>🌍 Instant public URLs</li>
                    </ul>
                </div>

                <div className="auth-card">
                    <div className="card-header">
                        <h2>Create an account</h2>
                        <p>Start managing your services with Cloudlane</p>
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        {error && <div className="error-banner">{error}</div>}

                        <div className="form-field">
                            <label htmlFor="organization">Organization</label>
                            <input
                                id="organization"
                                name="organization"
                                type="text"
                                required
                                value={organization}
                                onChange={(e) => setOrganization(e.target.value)}
                                placeholder="Acme Labs"
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                            />
                        </div>

                        <div className="form-field">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        <button type="submit" className="button-primary">
                            Create account
                        </button>
                    </form>

                    <p className="auth-footer">
                        Already have an account? <a href="/">Sign in</a>
                    </p>
                </div>
            </section>
        </main>
    )
}
