import { describe, expect, it } from 'vitest'
import { buildEpisodesByKey, buildRegionModel, findEpisodeAtIndex } from './regionModel'
import type { TimelinePoint } from '../types/timeline'

function pt(lat: number, lng: number, timestamp = 0): TimelinePoint {
  return { lat, lng, timestamp, kind: 'path' }
}

describe('buildRegionModel', () => {
  it('groups nearby points into a single cluster', () => {
    const points = [pt(37.5665, 126.978), pt(37.5666, 126.9781), pt(37.5667, 126.9779)]
    const { clusters, episodes } = buildRegionModel(points)
    expect(clusters.length).toBe(1)
    expect(episodes.length).toBe(1)
    expect(episodes[0].visitNumber).toBe(1)
  })

  it('creates a separate cluster for a far-away point', () => {
    const points = [pt(37.5665, 126.978), pt(35.1796, 129.0756)] // Seoul, then Busan
    const { clusters } = buildRegionModel(points)
    expect(clusters.length).toBe(2)
  })

  it('recognizes a return to a previously visited region as a 2nd visit', () => {
    const seoul = pt(37.5665, 126.978)
    const busan = pt(35.1796, 129.0756)
    const points = [seoul, seoul, busan, busan, seoul, seoul]
    const { clusters, episodes } = buildRegionModel(points)
    expect(clusters.length).toBe(2)
    expect(episodes.length).toBe(3) // Seoul, Busan, Seoul-again
    expect(episodes[0].visitNumber).toBe(1)
    expect(episodes[1].visitNumber).toBe(1)
    expect(episodes[2].visitNumber).toBe(2)
    expect(episodes[2].clusterId).toBe(episodes[0].clusterId)
  })

  it('handles an empty points array', () => {
    const { clusters, episodes } = buildRegionModel([])
    expect(clusters).toEqual([])
    expect(episodes).toEqual([])
  })
})

describe('findEpisodeAtIndex', () => {
  it('finds the episode covering a given fractional index', () => {
    const seoul = pt(37.5665, 126.978)
    const busan = pt(35.1796, 129.0756)
    const points = [seoul, seoul, busan, busan, seoul, seoul]
    const { episodes } = buildRegionModel(points)

    expect(findEpisodeAtIndex(episodes, 0)?.visitNumber).toBe(1)
    expect(findEpisodeAtIndex(episodes, 1.5)?.visitNumber).toBe(1)
    expect(findEpisodeAtIndex(episodes, 2.5)?.clusterId).toBe(episodes[1].clusterId)
    expect(findEpisodeAtIndex(episodes, 5)?.visitNumber).toBe(2)
  })

  it('returns null for an empty episode list', () => {
    expect(findEpisodeAtIndex([], 0)).toBeNull()
  })
})

describe('buildEpisodesByKey', () => {
  it('merges runs that share the same key, even across raw cluster boundaries', () => {
    // Simulates two proximity clusters within the same city (e.g. opposite ends
    // of Seoul) that both resolve to the name "Seoul" — should collapse into
    // one region instead of appearing as two separate visits.
    const keys = ['seoul-cluster-a', 'seoul-cluster-a', 'seoul-cluster-b', 'busan', 'seoul-cluster-a']
    const resolvedNames = new Map([
      ['seoul-cluster-a', 'Seoul'],
      ['seoul-cluster-b', 'Seoul'],
      ['busan', 'Busan'],
    ])
    const cityKeys = keys.map((k) => resolvedNames.get(k)!)
    const episodes = buildEpisodesByKey(cityKeys)

    // Seoul, Busan, Seoul-again — the two adjacent Seoul clusters merge into one episode.
    expect(episodes.length).toBe(3)
    expect(episodes[0].key).toBe('Seoul')
    expect(episodes[0].startIndex).toBe(0)
    expect(episodes[0].endIndex).toBe(2)
    expect(episodes[0].visitNumber).toBe(1)
    expect(episodes[1].key).toBe('Busan')
    expect(episodes[2].key).toBe('Seoul')
    expect(episodes[2].visitNumber).toBe(2)
  })

  it('handles an empty key array', () => {
    expect(buildEpisodesByKey([])).toEqual([])
  })
})
