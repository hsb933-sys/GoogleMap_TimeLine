// Loose types for Google's exported Timeline.json. Field names/casing vary
// across export versions, so these are intentionally permissive (unknown-ish)
// and the parser tolerates missing/renamed fields rather than trusting these.

export interface RawTimelineFile {
  semanticSegments?: RawSemanticSegment[]
  rawSignals?: unknown[]
  userLocationProfile?: unknown
}

export interface RawSemanticSegment {
  startTime?: string
  startTimestamp?: string
  endTime?: string
  endTimestamp?: string
  visit?: RawVisit
  activity?: RawActivity
  timelinePath?: RawPathPoint[]
}

export interface RawVisit {
  topCandidate?: {
    placeId?: string
    place_id?: string
    placeLocation?: { latLng?: string }
    place_location?: { lat_lng?: string }
  }
  placeLocation?: { latLng?: string }
}

export interface RawActivity {
  topCandidate?: { type?: string }
  start?: { latLng?: string }
  end?: { latLng?: string }
  path?: RawPathPoint[]
}

export interface RawPathPoint {
  point?: string
  latLng?: string
  lat_lng?: string
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
  time?: string
  timestamp?: string
}

// Normalized point used throughout the app, independent of Google's raw shape.
export type PointKind = 'visit' | 'path'

export interface TimelinePoint {
  timestamp: number // epoch ms
  lat: number
  lng: number
  kind: PointKind
  placeId?: string
  activityType?: string
}

export interface ParsedTimeline {
  points: TimelinePoint[]
  minDate: Date | null
  maxDate: Date | null
  warnings: string[]
}
