import type { TimelinePoint } from '../types/timeline'

/**
 * Google Timeline exports can contain hundreds of thousands of points for a
 * multi-year history. Rendering that many vertices every animation frame (or
 * as a single Leaflet Polyline) is what causes the page to freeze, so callers
 * that only need a visual trail (not source-of-truth data) should decimate
 * first. Points are assumed sorted ascending by timestamp; a plain fixed-stride
 * sample preserves that order and is O(n), unlike a real simplification
 * algorithm (e.g. Douglas-Peucker) which isn't needed for a recap-video trail.
 */
export function decimatePoints(points: TimelinePoint[], maxPoints: number): TimelinePoint[] {
  if (points.length <= maxPoints || maxPoints <= 0) return points

  const stride = Math.ceil(points.length / maxPoints)
  const result: TimelinePoint[] = []
  for (let i = 0; i < points.length; i += stride) {
    result.push(points[i])
  }
  const last = points[points.length - 1]
  if (result[result.length - 1] !== last) result.push(last)
  return result
}
