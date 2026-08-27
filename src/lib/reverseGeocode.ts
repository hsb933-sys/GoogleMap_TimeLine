import type { RegionCluster } from './regionModel'

export interface RegionInfo {
  city: string
  country: string
}

// Module-level so results are reused across engine instances (e.g. re-selecting
// a date range) instead of re-fetching the same region.
const infoCache = new Map<string, RegionInfo>()

// BigDataCloud's client-reverse-geocode endpoint is free, keyless, and (unlike
// Nominatim's /reverse, confirmed CORS-blocked for direct browser fetches from
// both localhost and a real deployed domain) sends CORS headers for direct
// browser use. No published hard rate limit, but a small spacing is kept to
// stay a well-behaved client rather than firing a burst of requests.
const MIN_REQUEST_INTERVAL_MS = 250
let lastRequestAt = 0

function cacheKey(lat: number, lng: number): string {
  // ~1km grid is plenty precise for a city/county-level label.
  return `${lat.toFixed(2)},${lng.toFixed(2)}`
}

interface BigDataCloudResponse {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryName?: string
}

async function fetchRegionInfo(lat: number, lng: number): Promise<RegionInfo> {
  const key = cacheKey(lat, lng)
  const cached = infoCache.get(key)
  if (cached) return cached

  const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequestAt = Date.now()

  const fallback: RegionInfo = { city: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`, country: '' }
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ko`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`BigDataCloud ${res.status}`)
    const data = (await res.json()) as BigDataCloudResponse
    const info: RegionInfo = {
      city: data.city || data.locality || data.principalSubdivision || fallback.city,
      country: data.countryName || '',
    }
    infoCache.set(key, info)
    return info
  } catch {
    // Offline, blocked, or rate-limited: fall back to coordinates rather than failing the whole video.
    infoCache.set(key, fallback)
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
    const info = await fetchRegionInfo(cluster.lat, cluster.lng)
    result.set(cluster.id, info.city)
    onResolved?.(cluster.id, info.city)
  }
  return result
}

/** Same as resolveRegionNames, but keeps the country alongside the city for callers that need both. */
export async function resolveRegionInfos(
  clusters: RegionCluster[],
  onResolved?: (clusterId: number, info: RegionInfo) => void,
): Promise<Map<number, RegionInfo>> {
  const result = new Map<number, RegionInfo>()
  for (const cluster of clusters) {
    const info = await fetchRegionInfo(cluster.lat, cluster.lng)
    result.set(cluster.id, info)
    onResolved?.(cluster.id, info)
  }
  return result
}
