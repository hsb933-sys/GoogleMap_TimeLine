import { haversineMeters } from './geo'
import type { TimelinePoint } from '../types/timeline'

export interface RegionCluster {
  id: number
  lat: number
  lng: number
}

/** A contiguous run of points belonging to the same region cluster. */
export interface RegionEpisode {
  clusterId: number
  startIndex: number
  endIndex: number
  /** 1-based count of how many separate times this cluster has been entered, up to and including this episode. */
  visitNumber: number
}

export interface RegionModel {
  clusters: RegionCluster[]
  episodes: RegionEpisode[]
}

// City/metro-area granularity: points within this radius of an existing
// cluster's representative point are folded into the same region rather than
// spawning a new one. Coarse enough that a Nominatim zoom=10 lookup ("city")
// stays meaningful for the cluster as a whole.
const CLUSTER_RADIUS_METERS = 15000

/**
 * Greedily clusters points into regions by proximity (chronological order,
 * nearest-existing-cluster-within-radius, else new cluster), then derives
 * "episodes" — contiguous visits to a region — with a running visit count
 * per region so a later return to an already-seen place is recognizable as
 * e.g. "2nd visit".
 */
export function buildRegionModel(points: TimelinePoint[]): RegionModel {
  const clusters: RegionCluster[] = []
  const pointCluster: number[] = new Array(points.length)

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    let bestId = -1
    let bestDist = Infinity
    for (const c of clusters) {
      const d = haversineMeters(p.lat, p.lng, c.lat, c.lng)
      if (d < bestDist) {
        bestDist = d
        bestId = c.id
      }
    }
    if (bestId === -1 || bestDist > CLUSTER_RADIUS_METERS) {
      const id = clusters.length
      clusters.push({ id, lat: p.lat, lng: p.lng })
      pointCluster[i] = id
    } else {
      pointCluster[i] = bestId
    }
  }

  const episodes: RegionEpisode[] = []
  const visitCounts = new Map<number, number>()
  if (pointCluster.length > 0) {
    let curCluster = pointCluster[0]
    let startIndex = 0
    for (let i = 1; i <= pointCluster.length; i++) {
      const c = i < pointCluster.length ? pointCluster[i] : null
      if (c !== curCluster) {
        const count = (visitCounts.get(curCluster) ?? 0) + 1
        visitCounts.set(curCluster, count)
        episodes.push({ clusterId: curCluster, startIndex, endIndex: i - 1, visitNumber: count })
        if (c !== null) {
          curCluster = c
          startIndex = i
        }
      }
    }
  }

  return { clusters, episodes }
}

/** Finds the episode covering the given fractional point index (episodes are sorted, non-overlapping). */
export function findEpisodeAtIndex(episodes: RegionEpisode[], fractionalIndex: number): RegionEpisode | null {
  if (episodes.length === 0) return null
  const idx = Math.floor(fractionalIndex)
  let lo = 0
  let hi = episodes.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const ep = episodes[mid]
    if (idx < ep.startIndex) hi = mid - 1
    else if (idx > ep.endIndex) lo = mid + 1
    else return ep
  }
  return episodes[episodes.length - 1]
}
