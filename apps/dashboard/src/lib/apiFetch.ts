import { getApiBase } from './api'

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiBase = getApiBase()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    return await fetch(`${apiBase}${path}`, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `API request timed out. On Netlify, set DATABASE_URL (MongoDB Atlas) and JWT_SECRET, then redeploy.`
      )
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
