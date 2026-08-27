import type {
  ParsedTimeline,
  RawPathPoint,
  RawSemanticSegment,
  RawTimelineFile,
  TimelinePoint,
} from '../types/timeline'

/**
 * Parses a "37.4219°, -122.0840°" or "37.4219,-122.0840" style latLng string.
 * Returns null (rather than throwing) when it can't make sense of the input,
 * so the caller can record a warning and skip that segment.
 */
function parseLatLngString(value: string | undefined | null): { lat: number; lng: number } | null {
  if (!value) return null
  const cleaned = value.replace(/°/g, '').trim()
  const parts = cleaned.split(',').map((p) => Number.parseFloat(p.trim()))
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null
  const [lat, lng] = parts
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function extractLatLng(point: RawPathPoint): { lat: number; lng: number } | null {
  const fromString = parseLatLngString(point.point ?? point.latLng ?? point.lat_lng)
  if (fromString) return fromString
  const lat = point.latitude ?? point.lat
  const lng = point.longitude ?? point.lng
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
  return null
}

function parseTimestamp(value: string | undefined | null): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

function parseVisitSegment(
  segment: RawSemanticSegment,
  warnings: string[],
  index: number,
): TimelinePoint | null {
  const visit = segment.visit
  if (!visit) return null

  const latLngStr =
    visit.topCandidate?.placeLocation?.latLng ??
    visit.topCandidate?.place_location?.lat_lng ??
    visit.placeLocation?.latLng
  const coords = parseLatLngString(latLngStr)
  const timestamp = parseTimestamp(segment.startTime ?? segment.startTimestamp)

  if (!coords || timestamp === null) {
    warnings.push(`Segment ${index}: could not parse visit (missing coords or start time)`)
    return null
  }

  return {
    timestamp,
    lat: coords.lat,
    lng: coords.lng,
    kind: 'visit',
    placeId: visit.topCandidate?.placeId ?? visit.topCandidate?.place_id,
  }
}

function parseActivitySegment(
  segment: RawSemanticSegment,
  warnings: string[],
  index: number,
): TimelinePoint[] {
  const rawPath = segment.timelinePath ?? segment.activity?.path
  const activityType = segment.activity?.topCandidate?.type
  const points: TimelinePoint[] = []

  if (rawPath && rawPath.length > 0) {
    for (const [pointIndex, rawPoint] of rawPath.entries()) {
      const coords = extractLatLng(rawPoint)
      const timestamp = parseTimestamp(rawPoint.time ?? rawPoint.timestamp)
      if (!coords || timestamp === null) {
        warnings.push(`Segment ${index}, path point ${pointIndex}: could not parse (skipped)`)
        continue
      }
      points.push({
        timestamp,
        lat: coords.lat,
        lng: coords.lng,
        kind: 'path',
        activityType,
      })
    }
    return points
  }

  // Fall back to just start/end of the activity if no detailed path is present.
  const activity = segment.activity
  if (activity) {
    const startCoords = parseLatLngString(activity.start?.latLng)
    const startTs = parseTimestamp(segment.startTime ?? segment.startTimestamp)
    if (startCoords && startTs !== null) {
      points.push({ timestamp: startTs, lat: startCoords.lat, lng: startCoords.lng, kind: 'path', activityType })
    }
    const endCoords = parseLatLngString(activity.end?.latLng)
    const endTs = parseTimestamp(segment.endTime ?? segment.endTimestamp)
    if (endCoords && endTs !== null) {
      points.push({ timestamp: endTs, lat: endCoords.lat, lng: endCoords.lng, kind: 'path', activityType })
    }
    if (points.length === 0) {
      warnings.push(`Segment ${index}: activity segment had no usable path or start/end coords`)
    }
  }

  return points
}

export function parseTimelineJson(raw: unknown): ParsedTimeline {
  const warnings: string[] = []
  const points: TimelinePoint[] = []

  if (typeof raw !== 'object' || raw === null) {
    return { points: [], minDate: null, maxDate: null, warnings: ['File is not a valid JSON object'] }
  }

  const file = raw as RawTimelineFile
  const segments = Array.isArray(file.semanticSegments) ? file.semanticSegments : []

  if (segments.length === 0) {
    warnings.push('No semanticSegments array found in file (or it was empty)')
  }

  segments.forEach((segment, index) => {
    if (segment.visit) {
      const point = parseVisitSegment(segment, warnings, index)
      if (point) points.push(point)
    } else if (segment.activity || segment.timelinePath) {
      points.push(...parseActivitySegment(segment, warnings, index))
    } else {
      warnings.push(`Segment ${index}: unrecognized shape (no visit/activity/timelinePath), skipped`)
    }
  })

  points.sort((a, b) => a.timestamp - b.timestamp)

  const deduped: TimelinePoint[] = []
  let prevKey = ''
  for (const p of points) {
    const key = `${p.timestamp}:${p.lat.toFixed(6)}:${p.lng.toFixed(6)}`
    if (key === prevKey) continue
    prevKey = key
    deduped.push(p)
  }

  const minDate = deduped.length > 0 ? new Date(deduped[0].timestamp) : null
  const maxDate = deduped.length > 0 ? new Date(deduped[deduped.length - 1].timestamp) : null

  return { points: deduped, minDate, maxDate, warnings }
}
