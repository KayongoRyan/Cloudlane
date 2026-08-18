import type { ServiceId } from './consoleNavMenus'
import { SERVICE_LABELS } from './consoleNavMenus'

const RECENT_KEY = 'cl-recent-services'
const MAX_RECENT = 8

export function readRecentServices(): ServiceId[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as ServiceId[]) : []
  } catch {
    return []
  }
}

export function pushRecentService(id: ServiceId) {
  const skip = new Set<ServiceId>(['hub', 'hub-home', 'solutions'])
  if (skip.has(id)) return

  const prev = readRecentServices().filter((x) => x !== id)
  const next = [id, ...prev].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

export function recentServiceLabels(ids: ServiceId[]): { id: ServiceId; label: string }[] {
  return ids
    .filter((id) => SERVICE_LABELS[id])
    .map((id) => ({ id, label: SERVICE_LABELS[id] }))
}
