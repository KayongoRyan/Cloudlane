import { getApiBase } from './api'

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function consoleApiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, { headers: authHeaders() })
  if (res.status === 401) throw new Error('Not signed in — open Cloudlane dashboard and log in.')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = body.detail
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail) || 'Request failed')
  }
  return res.json()
}

export async function consoleApiSend<T = unknown>(path: string, method: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) throw new Error('Not signed in — open Cloudlane dashboard and log in.')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const detail = data.detail
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail) || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json() as Promise<T>
}
