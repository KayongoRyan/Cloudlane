/** Netlify production API — update if your Netlify site URL changes. */
export const PRODUCTION_API_URL = 'https://comfy-starlight-51c0e7.netlify.app'

/** Public API base URL (no trailing slash). */
export function getApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '')
  if (fromEnv && !fromEnv.includes('localhost')) return fromEnv

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host.includes('vercel.app') || host.includes('cloudlane-dashboard')) {
      return PRODUCTION_API_URL
    }
  }

  return fromEnv || 'http://localhost:3001'
}
