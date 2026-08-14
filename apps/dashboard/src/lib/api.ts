/** Public API base URL (no trailing slash). Set NEXT_PUBLIC_API_URL in Vercel for production. */
export function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
}
