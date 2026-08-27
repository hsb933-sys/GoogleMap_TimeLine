import type { RegionCluster } from './regionModel'

// Module-level so results are reused across engine instances (e.g. re-selecting
// a date range) instead of re-fetching the same region.
const nameCache = new Map<string, string>()

// Nominatim's usage policy caps unauthenticated use at ~1 request/second.
const MIN_REQUEST_INTERVAL_MS = 1100
let lastRequestAt = 0

function cacheKey(lat: number, lng: number): string {
  // ~1km grid is plenty precise for a city/county-level label.
  return `${lat.toFixed(2)},${lng.toFixed(2)}`
}

interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  county?: string
  state?: string
  country?: string
}

async function fetchRegionName(lat: number, lng: number): Promise<string> {
  const key = cacheKey(lat, lng)
  const cached = nameCache.get(key)
  if (cached) return cached

  const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequestAt = Date.now()

  const fallback = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=ko`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    const data = (await res.json()) as { address?: NominatimAddress; name?: string }
    const addr = data.address ?? {}
    const name = addr.city || addr.town || addr.village || addr.county || addr.state || addr.country || data.name || fallback
    nameCache.set(key, name)
    return name
  } catch {
    // Offline, blocked, or rate-limited: fall back to coordinates rather than failing the whole video.
    nameCache.set(key, fallback)
    return fallback
  }
}

/**
 * Resolves a human-readable region name for each cluster, one request at a
 * time (rate-limited), calling onResolved as each completes so callers can
 * update a live preview progressively instead of waiting for all of them.
 */
export async function resolveRegionNames(
  clusters: RegionCluster[],
  onResolved?: (clusterId: number, name: string) => void,
): Promise<Map<number, string>> {
  const result = new Map<number, string>()
  for (const cluster of clusters) {
    const name = await fetchRegionName(cluster.lat, cluster.lng)
    result.set(cluster.id, name)
    onResolved?.(cluster.id, name)
  }
  return result
}
