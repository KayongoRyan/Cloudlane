import { getApiBase } from './api'

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiBase = getApiBase()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    return await fetch(`${apiBase}${path}`, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `API request timed out. Confirm Netlify DATABASE_URL is the Atlas URI, JWT_SECRET is set, Atlas Network Access allows 0.0.0.0/0, then Trigger deploy.`
      )
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
