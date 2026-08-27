import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { CanvasMapEngine } from '../lib/canvasMapRenderer'
import { decimatePoints } from '../lib/decimatePoints'
import { buildRegionModel } from '../lib/regionModel'
import { resolveRegionNames } from '../lib/reverseGeocode'
import { recordCanvasAnimation } from '../lib/videoExporter'
import { usePlaybackStore } from '../store/usePlaybackStore'
import type { TimelinePoint } from '../types/timeline'

export interface CanvasRecorderHandle {
  exportVideo: () => Promise<Blob>
}

interface Props {
  points: TimelinePoint[]
  rangeFromMs: number
  rangeToMs: number
  previewDurationMs: number
}

// A multi-year export can put 100k+ points in a single selected range; drawing
// that many canvas lineTo() calls every animation frame is what freezes the
// page during preview/export, so the trail is decimated once per range change.
const MAX_TRAIL_POINTS = 4000

export const CanvasRecorder = forwardRef<CanvasRecorderHandle, Props>(function CanvasRecorder(
  { points, rangeFromMs, rangeToMs, previewDurationMs },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CanvasMapEngine | null>(null)
  const rafRef = useRef<number>(0)
  const playStartRef = useRef<number>(0)
  const regionNamesRef = useRef<Map<number, string>>(new Map())
  const regionResolvePromiseRef = useRef<Promise<Map<number, string>> | null>(null)

  const trailPoints = useMemo(() => decimatePoints(points, MAX_TRAIL_POINTS), [points])
  const regionModel = useMemo(() => buildRegionModel(trailPoints), [trailPoints])

  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const progress = usePlaybackStore((s) => s.progress)
  const setProgress = usePlaybackStore((s) => s.setProgress)
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying)
  const exportDurationSec = usePlaybackStore((s) => s.exportDurationSec)
  const setIsRecording = usePlaybackStore((s) => s.setIsRecording)
  const setRecordingProgress = usePlaybackStore((s) => s.setRecordingProgress)
  const setIsResolvingRegions = usePlaybackStore((s) => s.setIsResolvingRegions)

  useEffect(() => {
    if (!canvasRef.current) return
    regionNamesRef.current = new Map()
    engineRef.current = new CanvasMapEngine({
      canvas: canvasRef.current,
      points: trailPoints,
      rangeFromMs,
      rangeToMs,
      regionModel,
      regionNames: regionNamesRef.current,
    })
    engineRef.current.drawFrame(0)

    // Resolve region display names in the background (rate-limited network
    // calls), redrawing the current frame as each one comes in. regionNamesRef
    // is the same Map instance the engine reads, so mutating it in place is
    // enough — no need to recreate the engine as names resolve.
    regionResolvePromiseRef.current = resolveRegionNames(regionModel.clusters, (id, name) => {
      regionNamesRef.current.set(id, name)
      engineRef.current?.drawFrame(usePlaybackStore.getState().progress)
    })
  }, [trailPoints, rangeFromMs, rangeToMs, regionModel])

  // Draw whenever progress changes (scrubbing, or the play loop below).
  useEffect(() => {
    engineRef.current?.drawFrame(progress)
  }, [progress])

  useEffect(() => {
    if (!isPlaying) return
    if (progress <= 0) engineRef.current?.resetCamera()
    playStartRef.current = performance.now() - progress * previewDurationMs

    const tick = () => {
      const elapsed = performance.now() - playStartRef.current
      const clamped = Math.min(elapsed, previewDurationMs)
      setProgress(clamped / previewDurationMs)
      if (elapsed >= previewDurationMs) {
        setIsPlaying(false)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  useImperativeHandle(ref, () => ({
    async exportVideo() {
      const canvas = canvasRef.current
      const engine = engineRef.current
      if (!canvas || !engine) throw new Error('Canvas not ready')

      setIsPlaying(false)
      setRecordingProgress(0)
      engine.resetCamera()
      try {
        // Make sure every visited region's name has resolved before recording
        // starts, so the exported video never shows a "확인 중" placeholder.
        setIsResolvingRegions(true)
        await regionResolvePromiseRef.current
      } finally {
        setIsResolvingRegions(false)
      }
      setIsRecording(true)
      const durationMs = exportDurationSec * 1000
      try {
        const blob = await recordCanvasAnimation({
          canvas,
          durationMs,
          fps: 30,
          onFrame: (elapsedMs) => {
            engine.drawFrame(elapsedMs / durationMs)
          },
          onProgress: (p) => setRecordingProgress(p),
        })
        return blob
      } finally {
        setIsRecording(false)
      }
    },
  }))

  return <canvas ref={canvasRef} width={800} height={500} className="recorder-canvas" />
})
