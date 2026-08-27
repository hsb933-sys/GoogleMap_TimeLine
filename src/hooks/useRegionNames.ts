import { useEffect, useMemo, useRef, useState } from 'react'
import { decimatePoints } from '../lib/decimatePoints'
import { buildRegionModel, type RegionModel } from '../lib/regionModel'
import { resolveRegionNames } from '../lib/reverseGeocode'
import type { TimelinePoint } from '../types/timeline'

// Clustering cost scales with point count; a multi-year export can have
// 100k+ points, so cap it the same way the trail renderer does.
const MAX_CLUSTERING_POINTS = 4000

export interface RegionSummary {
  clusterId: number
  name: string
  /** How many separate times this region was entered (>1 means revisited). */
  visitCount: number
  firstVisitTimestamp: number
}

export interface UseRegionNamesResult {
  regionModel: RegionModel
  /** Cluster id -> resolved display name (falls back to coordinates if lookup failed). */
  names: Map<number, string>
  isResolving: boolean
  /** Resolves once every cluster's name is known (or has fallen back). */
  resolvePromise: Promise<Map<number, string>>
  /** One entry per distinct region, ordered by when it was first visited. */
  summaries: RegionSummary[]
}

/** Clusters the given points into regions, reverse-geocodes each (rate-limited, cached), and summarizes visits. */
export function useRegionNames(points: TimelinePoint[]): UseRegionNamesResult {
  const trailPoints = useMemo(() => decimatePoints(points, MAX_CLUSTERING_POINTS), [points])
  const regionModel = useMemo(() => buildRegionModel(trailPoints), [trailPoints])

  const [names, setNames] = useState<Map<number, string>>(new Map())
  const [isResolving, setIsResolving] = useState(false)
  const resolvePromiseRef = useRef<Promise<Map<number, string>>>(Promise.resolve(new Map()))

  useEffect(() => {
    let cancelled = false
    setNames(new Map())

    if (regionModel.clusters.length === 0) {
      resolvePromiseRef.current = Promise.resolve(new Map())
      return
    }

    setIsResolving(true)
    const collected = new Map<number, string>()
    resolvePromiseRef.current = resolveRegionNames(regionModel.clusters, (id, name) => {
      if (cancelled) return
      collected.set(id, name)
      setNames(new Map(collected))
    }).then((result) => {
      if (!cancelled) setIsResolving(false)
      return result
    })

    return () => {
      cancelled = true
    }
  }, [regionModel])

  const summaries = useMemo<RegionSummary[]>(() => {
    const byCluster = new Map<number, RegionSummary>()
    for (const episode of regionModel.episodes) {
      const name = names.get(episode.clusterId) ?? '지역 확인 중…'
      const existing = byCluster.get(episode.clusterId)
      if (!existing) {
        byCluster.set(episode.clusterId, {
          clusterId: episode.clusterId,
          name,
          visitCount: episode.visitNumber,
          firstVisitTimestamp: trailPoints[episode.startIndex]?.timestamp ?? 0,
        })
      } else {
        existing.name = name
        existing.visitCount = Math.max(existing.visitCount, episode.visitNumber)
      }
    }
    return [...byCluster.values()].sort((a, b) => a.firstVisitTimestamp - b.firstVisitTimestamp)
  }, [regionModel, names, trailPoints])

  return { regionModel, names, isResolving, resolvePromise: resolvePromiseRef.current, summaries }
}
