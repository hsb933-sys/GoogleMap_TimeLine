import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseTimelineJson } from './timelineParser'

const fixturePath = fileURLToPath(new URL('../../fixtures/sample-timeline.json', import.meta.url))
const fixtureRaw = JSON.parse(readFileSync(fixturePath, 'utf-8'))

describe('parseTimelineJson', () => {
  it('parses the mixed sample fixture', () => {
    const result = parseTimelineJson(fixtureRaw)

    // 1 visit + 5 path + 1 visit(snake_case) + 4 path + 1 visit + 4 path = 16
    expect(result.points.length).toBe(16)
    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]).toContain('Segment 6')
  })

  it('sorts points by timestamp ascending', () => {
    const result = parseTimelineJson(fixtureRaw)
    for (let i = 1; i < result.points.length; i++) {
      expect(result.points[i].timestamp).toBeGreaterThanOrEqual(result.points[i - 1].timestamp)
    }
  })

  it('computes min/max date bounds', () => {
    const result = parseTimelineJson(fixtureRaw)
    expect(result.minDate?.toISOString()).toBe('2023-01-05T09:00:00.000Z')
    expect(result.maxDate?.toISOString()).toBe('2023-07-20T08:30:00.000Z')
  })

  it('parses degree-symbol latLng strings', () => {
    const result = parseTimelineJson(fixtureRaw)
    const home = result.points.find((p) => p.placeId === 'ChIJ_place_home')
    expect(home?.lat).toBeCloseTo(37.5665, 3)
    expect(home?.lng).toBeCloseTo(126.978, 3)
  })

  it('parses snake_case visit fields', () => {
    const result = parseTimelineJson(fixtureRaw)
    const office = result.points.find((p) => p.placeId === 'ChIJ_place_office')
    expect(office).toBeDefined()
    expect(office?.lat).toBeCloseTo(37.4979, 3)
  })

  it('parses activity path points with latitude/longitude fields', () => {
    const result = parseTimelineJson(fixtureRaw)
    const drivingPoints = result.points.filter((p) => p.activityType === 'driving')
    expect(drivingPoints.length).toBe(4)
  })

  it('handles an empty/malformed file without throwing', () => {
    const result = parseTimelineJson({})
    expect(result.points).toEqual([])
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('handles non-object input without throwing', () => {
    const result = parseTimelineJson(null)
    expect(result.points).toEqual([])
    expect(result.minDate).toBeNull()
  })
})
