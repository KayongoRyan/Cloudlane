import { getApiBase } from './api'

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function extractErrorMessage(body: unknown, status: number, path: string): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    if (typeof b.detail === 'string') return b.detail
    if (typeof b.error === 'string') return b.error
    if (Array.isArray(b.detail)) {
      return b.detail
        .map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: unknown }).msg) : JSON.stringify(d)))
        .join('; ')
    }
    if (b.detail != null) return JSON.stringify(b.detail)
  }
  if (typeof body === 'string' && body.includes('Cannot GET')) {
    return `API ${status}: ${path} not found on this backend (deploy Python API or point NEXT_PUBLIC_API_URL at localhost:8001)`
  }
  if (typeof body === 'string' && body.includes('Cannot POST')) {
    return `API ${status}: ${path} not found on this backend (deploy Python API or point NEXT_PUBLIC_API_URL at localhost:8001)`
  }
  if (status === 404) {
    return `API 404: ${path} — endpoint missing on current API (${getApiBase()})`
  }
  return `Request failed (${status}) ${path}`
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function consoleApiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { headers: authHeaders() })
  if (res.status === 401) {
    const body = await readBody(res)
    const msg = extractErrorMessage(body, 401, path)
    throw new Error(
      msg.includes('Missing') || msg.includes('Invalid') || msg.includes('expired')
        ? `${msg} — sign out and log in again (token must match ${getApiBase()}).`
        : `Not signed in — log in again against ${getApiBase()}.`,
    )
  }
  if (!res.ok) {
    const body = await readBody(res)
    throw new Error(extractErrorMessage(body, res.status, path))
  }
  return res.json() as Promise<T>
}

export async function consoleApiSend<T = unknown>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T | null> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    const errBody = await readBody(res)
    const msg = extractErrorMessage(errBody, 401, path)
    throw new Error(
      msg.includes('Missing') || msg.includes('Invalid') || msg.includes('expired')
        ? `${msg} — sign out and log in again (token must match ${getApiBase()}).`
        : `Not signed in — log in again against ${getApiBase()}.`,
    )
  }
  if (!res.ok) {
    const errBody = await readBody(res)
    throw new Error(extractErrorMessage(errBody, res.status, path))
  }
  if (res.status === 204) return null
  return res.json() as Promise<T>
}
