/** Netlify production API */
export const PRODUCTION_API_URL = 'https://comfy-starlight-51c0e7.netlify.app'

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

/** Public API base URL (no trailing slash). */
export function getApiBase(): string {
  // Production / preview hosts always use Netlify (works even if build env was wrong)
  if (typeof window !== 'undefined' && !isLocalHost()) {
    return PRODUCTION_API_URL
  }

  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '')
  if (fromEnv) return fromEnv

  return 'http://localhost:8001'
}

export function apiReachabilityHint(apiBase: string): string {
  if (apiBase.includes('localhost')) {
    return 'Start MongoDB (docker compose up -d) and the API (cd apps/api_python && python -m uvicorn main:app --reload --port 8001).'
  }
  return 'On Netlify: set DATABASE_URL (MongoDB Atlas) and JWT_SECRET, then trigger a redeploy.'
}
