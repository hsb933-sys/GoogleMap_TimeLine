import { TILE_SIZE, fitZoom, lonLatToWorldPixel, osmTileUrl } from './tileMath'
import { haversineMeters } from './geo'
import { findEpisodeAtIndex, type RegionModel } from './regionModel'
import type { TimelinePoint } from '../types/timeline'

const tileImageCache = new Map<string, HTMLImageElement | 'loading' | 'error'>()

function getTileImage(z: number, x: number, y: number): HTMLImageElement | null {
  const key = `${z}/${x}/${y}`
  const cached = tileImageCache.get(key)
  if (cached instanceof HTMLImageElement) return cached
  if (cached === 'loading' || cached === 'error') return null

  tileImageCache.set(key, 'loading')
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => tileImageCache.set(key, img)
  img.onerror = () => tileImageCache.set(key, 'error')
  img.src = osmTileUrl(z, x, y)
  return null
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

interface RoutePosition {
  lat: number
  lng: number
  timestamp: number
  /** Fractional index into the points array (e.g. 4.3 = 30% of the way from point 4 to point 5). */
  index: number
  /** Cumulative distance traveled (meters) from the start of the route to this position. */
  distanceMeters: number
}

const FOLLOW_WINDOW_POINTS = 50
const FOLLOW_MAX_ZOOM = 15
const CAMERA_EASE = 0.08
const MAX_TILE_ZOOM = 19
// Last portion of the video where the camera eases out from following the
// current position to an overview of the entire selected route.
const END_REVEAL_FRACTION = 0.15
// Minimum distance the current-position marker must keep from the canvas
// edge (as a fraction of the shorter canvas dimension). If gently easing the
// camera toward its target would put the marker closer than this, the
// camera snaps straight to the target instead, so a fast-moving
// (long-distance) segment never outruns the camera off-screen.
const SAFE_MARGIN_FRACTION = 0.22

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

export interface CanvasMapEngineOptions {
  canvas: HTMLCanvasElement
  points: TimelinePoint[]
  rangeFromMs: number
  rangeToMs: number
  /** Region clustering/visit-episode data for the same `points` array, used to label the current region. */
  regionModel?: RegionModel
  /**
   * Cluster id -> resolved display name. Passed by reference and mutated in
   * place by the caller as reverse-geocoding results come in, so the engine
   * always reads the latest names without needing to be reconstructed.
   */
  regionNames?: Map<number, string>
}

/**
 * Renders an animated "reveal" of a travel route onto a plain <canvas>,
 * independent of Leaflet, so the identical draw code can drive both the
 * interactive preview and the MediaRecorder export capture.
 *
 * Playback progress (0..1) is mapped to a position along the route by
 * cumulative distance, not by raw timestamp: real Timeline data has very
 * uneven point density (a GPS ping every few seconds while walking, a single
 * point spanning a multi-hour flight), so a timestamp-linear mapping makes
 * the marker sit still for most of the video then teleport across a
 * continent in one frame. Distance-based pacing instead gives the marker a
 * roughly constant on-screen speed, and positions are linearly interpolated
 * between the two surrounding data points so it glides continuously instead
 * of snapping from point to point.
 *
 * The camera starts zoomed in on the route's starting point, follows the
 * (interpolated) current position as it moves — zoomed in tight while moving
 * slowly, pulled back automatically when covering long distances fast, since
 * the follow zoom is fit to a trailing window of recent points — and during
 * the last portion of the video eases out into an overview that shows the
 * entire traveled route.
 */
export class CanvasMapEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private points: TimelinePoint[]
  private cumDist: number[]
  private totalDist: number
  private overallFit: { zoom: number; centerLon: number; centerLat: number }
  private regionModel?: RegionModel
  private regionNames?: Map<number, string>

  private cameraZoom = 0
  private cameraLon = 0
  private cameraLat = 0
  private cameraInitialized = false

  constructor(options: CanvasMapEngineOptions) {
    this.canvas = options.canvas
    const ctx = options.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    this.ctx = ctx
    this.points = options.points
    this.regionModel = options.regionModel
    this.regionNames = options.regionNames

    this.cumDist = new Array(this.points.length).fill(0)
    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i - 1]
      const cur = this.points[i]
      this.cumDist[i] = this.cumDist[i - 1] + haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng)
    }
    this.totalDist = this.cumDist[this.points.length - 1] ?? 0

    this.overallFit = fitZoom(
      this.points.map((p) => ({ lat: p.lat, lng: p.lng })),
      options.canvas.width,
      options.canvas.height,
    )
  }

  /** Resets camera easing so scrubbing/replaying starts from the wide establishing shot again. */
  resetCamera() {
    this.cameraInitialized = false
  }

  /** Finds the point along the route at the given playback progress (0..1), interpolating between data points. */
  private getPositionAtProgress(progress: number): RoutePosition | null {
    const n = this.points.length
    if (n === 0) return null
    if (n === 1 || this.totalDist === 0) {
      const p = this.points[0]
      return { lat: p.lat, lng: p.lng, timestamp: p.timestamp, index: 0, distanceMeters: 0 }
    }

    const clamped = Math.min(1, Math.max(0, progress))
    const targetDist = clamped * this.totalDist

    // Rightmost index i such that cumDist[i] <= targetDist.
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1
      if (this.cumDist[mid] <= targetDist) lo = mid
      else hi = mid - 1
    }

    if (lo >= n - 1) {
      const p = this.points[n - 1]
      return { lat: p.lat, lng: p.lng, timestamp: p.timestamp, index: n - 1, distanceMeters: this.totalDist }
    }

    const segStart = this.cumDist[lo]
    const segEnd = this.cumDist[lo + 1]
    const segLen = segEnd - segStart
    const frac = segLen > 0 ? (targetDist - segStart) / segLen : 0
    const a = this.points[lo]
    const b = this.points[lo + 1]
    return {
      lat: lerp(a.lat, b.lat, frac),
      lng: lerp(a.lng, b.lng, frac),
      timestamp: lerp(a.timestamp, b.timestamp, frac),
      index: lo + frac,
      distanceMeters: targetDist,
    }
  }

  private updateCamera(pos: RoutePosition, progress: number) {
    const idx = Math.floor(pos.index)
    const windowStart = Math.max(0, idx - FOLLOW_WINDOW_POINTS)
    const windowLatLngs = this.points.slice(windowStart, idx + 1).map((p) => ({ lat: p.lat, lng: p.lng }))
    windowLatLngs.push({ lat: pos.lat, lng: pos.lng })

    const followTarget = fitZoom(windowLatLngs, this.canvas.width, this.canvas.height, FOLLOW_MAX_ZOOM)

    // Ease from the follow view into the full-route overview during the tail
    // of the video, so it ends by showing everywhere that was visited.
    const revealT = smoothstep((progress - (1 - END_REVEAL_FRACTION)) / END_REVEAL_FRACTION)
    const target = {
      centerLon: lerp(followTarget.centerLon, this.overallFit.centerLon, revealT),
      centerLat: lerp(followTarget.centerLat, this.overallFit.centerLat, revealT),
      zoom: lerp(followTarget.zoom, this.overallFit.zoom, revealT),
    }

    if (!this.cameraInitialized) {
      // First frame: snap straight to the target (e.g. zoomed in on the
      // starting point at progress 0) rather than easing in from elsewhere.
      this.cameraInitialized = true
      this.cameraLon = target.centerLon
      this.cameraLat = target.centerLat
      this.cameraZoom = target.zoom
      return
    }

    // Normally ease smoothly toward the target. But check where the marker
    // itself would actually land under that gently-eased camera: on a fast,
    // long-distance segment the target can shift by more than one easing
    // step covers, which would leave the marker outside the frame. In that
    // case snap the camera straight to the target instead — target is built
    // from a window that includes the marker, so it's guaranteed to contain
    // it — so the camera never lets the marker run off-screen.
    const easedLon = lerp(this.cameraLon, target.centerLon, CAMERA_EASE)
    const easedLat = lerp(this.cameraLat, target.centerLat, CAMERA_EASE)
    const easedZoom = lerp(this.cameraZoom, target.zoom, CAMERA_EASE)

    const markerWorld = lonLatToWorldPixel(pos.lng, pos.lat, easedZoom)
    const easedCenterWorld = lonLatToWorldPixel(easedLon, easedLat, easedZoom)
    const markerX = markerWorld.x - easedCenterWorld.x + this.canvas.width / 2
    const markerY = markerWorld.y - easedCenterWorld.y + this.canvas.height / 2
    const marginPx = Math.min(this.canvas.width, this.canvas.height) * SAFE_MARGIN_FRACTION
    const markerWithinBounds =
      markerX >= marginPx &&
      markerX <= this.canvas.width - marginPx &&
      markerY >= marginPx &&
      markerY <= this.canvas.height - marginPx

    if (markerWithinBounds) {
      this.cameraLon = easedLon
      this.cameraLat = easedLat
      this.cameraZoom = easedZoom
    } else {
      this.cameraLon = target.centerLon
      this.cameraLat = target.centerLat
      this.cameraZoom = target.zoom
    }
  }

  private project(lat: number, lng: number): { x: number; y: number } {
    const world = lonLatToWorldPixel(lng, lat, this.cameraZoom)
    const centerWorld = lonLatToWorldPixel(this.cameraLon, this.cameraLat, this.cameraZoom)
    return {
      x: world.x - centerWorld.x + this.canvas.width / 2,
      y: world.y - centerWorld.y + this.canvas.height / 2,
    }
  }

  private drawBasemap() {
    const { ctx, canvas, cameraZoom } = this
    const tileZoom = Math.min(MAX_TILE_ZOOM, Math.max(0, Math.round(cameraZoom)))
    const scale = 2 ** (cameraZoom - tileZoom)
    const effectiveTileSize = TILE_SIZE * scale

    const centerWorld = lonLatToWorldPixel(this.cameraLon, this.cameraLat, cameraZoom)
    const topLeftWorldX = centerWorld.x - canvas.width / 2
    const topLeftWorldY = centerWorld.y - canvas.height / 2

    const startTx = Math.floor(topLeftWorldX / effectiveTileSize)
    const startTy = Math.floor(topLeftWorldY / effectiveTileSize)
    const endTx = Math.ceil((topLeftWorldX + canvas.width) / effectiveTileSize)
    const endTy = Math.ceil((topLeftWorldY + canvas.height) / effectiveTileSize)

    ctx.fillStyle = '#e8e6e1'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const maxTileIndex = 2 ** tileZoom
    for (let tx = startTx; tx <= endTx; tx++) {
      for (let ty = startTy; ty <= endTy; ty++) {
        if (ty < 0 || ty >= maxTileIndex) continue
        const img = getTileImage(tileZoom, tx, ty)
        const dx = tx * effectiveTileSize - topLeftWorldX
        const dy = ty * effectiveTileSize - topLeftWorldY
        if (img) {
          ctx.drawImage(img, dx, dy, effectiveTileSize, effectiveTileSize)
        }
      }
    }
  }

  private getRegionLabel(pos: RoutePosition): string | null {
    if (!this.regionModel) return null
    const episode = findEpisodeAtIndex(this.regionModel.episodes, pos.index)
    if (!episode) return null
    const name = this.regionNames?.get(episode.clusterId) ?? '지역 확인 중…'
    return episode.visitNumber > 1 ? `${name} (${episode.visitNumber}번째 방문)` : name
  }

  /** Bottom overlay: cumulative distance traveled, current region (with visit count if revisited), and map attribution. */
  private drawBottomBar(pos: RoutePosition | null) {
    const { ctx, canvas } = this
    const barHeight = 28

    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight)

    ctx.font = '13px sans-serif'
    ctx.textBaseline = 'middle'
    const midY = canvas.height - barHeight / 2

    if (pos) {
      const distanceKm = (pos.distanceMeters / 1000).toFixed(1)
      const region = this.getRegionLabel(pos)
      const leftText = region ? `이동 거리 ${distanceKm} km  ·  ${region}` : `이동 거리 ${distanceKm} km`
      ctx.fillStyle = '#fff'
      ctx.fillText(leftText, 10, midY)
    }

    const rightText = '© OpenStreetMap contributors'
    const rightWidth = ctx.measureText(rightText).width
    ctx.fillStyle = '#fff'
    ctx.fillText(rightText, canvas.width - rightWidth - 10, midY)

    ctx.textBaseline = 'alphabetic'
  }

  /** Draws a single frame at the given playback progress (0..1) through the selected range. */
  drawFrame(progress: number) {
    const { ctx, canvas } = this
    const pos = this.getPositionAtProgress(progress)

    if (pos) {
      this.updateCamera(pos, progress)
      this.drawBasemap()

      const wholeIdx = Math.floor(pos.index)
      ctx.strokeStyle = '#e63946'
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i <= wholeIdx; i++) {
        const p = this.points[i]
        const { x, y } = this.project(p.lat, p.lng)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      const { x: cx, y: cy } = this.project(pos.lat, pos.lng)
      ctx.lineTo(cx, cy)
      ctx.stroke()

      ctx.fillStyle = '#1d3557'
      ctx.beginPath()
      ctx.arc(cx, cy, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, 6, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      this.drawBasemap()
      ctx.fillStyle = '#666'
      ctx.font = '14px sans-serif'
      ctx.fillText('No points in range yet', 16, 24)
    }

    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, canvas.width, 26)
    ctx.fillStyle = '#fff'
    ctx.font = '13px sans-serif'
    ctx.fillText(pos ? new Date(pos.timestamp).toLocaleString() : '', 8, 18)

    this.drawBottomBar(pos)
  }
}
