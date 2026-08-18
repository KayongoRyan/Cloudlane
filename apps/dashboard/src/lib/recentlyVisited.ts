import type { ServiceId } from '../components/consoleNavMenus'

const KEY = 'cl-recently-visited'
const MAX = 8

export function readRecentlyVisited(): ServiceId[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ServiceId[]) : []
  } catch {
    return []
  }
}

export function recordRecentlyVisited(id: ServiceId) {
  const next = [id, ...readRecentlyVisited().filter((x) => x !== id)].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
}
