/** Public API base URL (no trailing slash). Set NEXT_PUBLIC_API_URL on Vercel (dashboard). */
export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
}
