import { useEffect, useMemo, useState } from 'react'
import { decimatePoints } from '../lib/decimatePoints'
import { buildEpisodesByKey, buildRegionModel } from '../lib/regionModel'
import { resolveRegionInfos, type RegionInfo } from '../lib/reverseGeocode'
import type { TimelinePoint } from '../types/timeline'

// Clustering cost scales with point count; a multi-year export can have
// 100k+ points, so cap it the same way the trail renderer does.
const MAX_CLUSTERING_POINTS = 4000

export interface RegionTableRow {
  key: string
  country: string
  city: string
  /** How many separate times this city was entered (>1 means revisited). */
  visitCount: number
  firstVisitTimestamp: number
}

export interface UseRegionNamesResult {
  isResolving: boolean
  /** 0..1 fraction of distinct regions resolved so far (1 once done, 0 if nothing to resolve). */
  resolveProgress: number
  /** One row per distinct country+city, sorted by visit count descending. Empty until resolution finishes. */
  rows: RegionTableRow[]
}

function rowKey(info: RegionInfo): string {
  return `${info.country}|${info.city}`
}

/**
 * Clusters the given points into small proximity groups (just to batch
 * reverse-geocoding calls), resolves each to a city/country, then re-groups
 * by the resolved city name itself — a large city can span multiple
 * proximity clusters, and without this a visit to two neighborhoods 20km
 * apart would show up as two separate "regions" with the same name instead
 * of one merged, correctly-counted visit history.
 */
export function useRegionNames(points: TimelinePoint[]): UseRegionNamesResult {
  const trailPoints = useMemo(() => decimatePoints(points, MAX_CLUSTERING_POINTS), [points])
  const regionModel = useMemo(() => buildRegionModel(trailPoints), [trailPoints])

  const [isResolving, setIsResolving] = useState(false)
  const [resolveProgress, setResolveProgress] = useState(0)
  const [rows, setRows] = useState<RegionTableRow[]>([])

  useEffect(() => {
    let cancelled = false
    setRows([])
    setResolveProgress(0)

    const totalClusters = regionModel.clusters.length
    if (totalClusters === 0) {
      setIsResolving(false)
      return
    }

    setIsResolving(true)
    let resolvedCount = 0
    resolveRegionInfos(regionModel.clusters, () => {
      if (cancelled) return
      resolvedCount += 1
      setResolveProgress(resolvedCount / totalClusters)
    }).then((infoByCluster) => {
      if (cancelled) return

      const keyToInfo = new Map<string, RegionInfo>()
      const keys = regionModel.pointCluster.map((clusterId) => {
        const info = infoByCluster.get(clusterId) ?? { city: '알 수 없음', country: '' }
        const key = rowKey(info)
        keyToInfo.set(key, info)
        return key
      })

      const episodes = buildEpisodesByKey(keys)
      const byKey = new Map<string, RegionTableRow>()
      for (const episode of episodes) {
        const info = keyToInfo.get(episode.key)!
        const existing = byKey.get(episode.key)
        if (!existing) {
          byKey.set(episode.key, {
            key: episode.key,
            country: info.country,
            city: info.city,
            visitCount: episode.visitNumber,
            firstVisitTimestamp: trailPoints[episode.startIndex]?.timestamp ?? 0,
          })
        } else {
          existing.visitCount = Math.max(existing.visitCount, episode.visitNumber)
        }
      }

      setRows([...byKey.values()].sort((a, b) => b.visitCount - a.visitCount))
      setResolveProgress(1)
      setIsResolving(false)
    })

    return () => {
      cancelled = true
    }
  }, [regionModel, trailPoints])

  return { isResolving, resolveProgress, rows }
}
