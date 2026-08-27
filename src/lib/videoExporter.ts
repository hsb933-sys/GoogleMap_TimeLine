export interface RecordOptions {
  canvas: HTMLCanvasElement
  durationMs: number
  fps?: number
  onFrame: (elapsedMs: number) => void
  onProgress?: (progress: number) => void
}

function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) return type
  }
  return 'video/webm'
}

export function isRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
}

/**
 * Drives the given canvas's draw callback in real time while capturing it via
 * MediaRecorder, so the exported video matches the interactive preview frame-for-frame.
 */
export function recordCanvasAnimation(options: RecordOptions): Promise<Blob> {
  const { canvas, durationMs, fps = 30, onFrame, onProgress } = options

  return new Promise((resolve, reject) => {
    if (!isRecordingSupported()) {
      reject(new Error('This browser does not support video recording (MediaRecorder/captureStream unavailable).'))
      return
    }

    const stream = canvas.captureStream(fps)
    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks: BlobPart[] = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onerror = (e) => reject(e.error ?? new Error('MediaRecorder error'))
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }))
    }

    recorder.start()

    const startTime = performance.now()
    // Driven by setInterval rather than requestAnimationFrame: rAF is throttled to
    // near-zero in backgrounded/hidden tabs, which would stall an in-progress export
    // indefinitely if the user switches tabs. setInterval keeps firing (at a clamped
    // ~1/s when hidden) so the export still completes, just with coarser animation
    // frames while the tab is unfocused.
    const intervalMs = 1000 / fps
    const intervalId = setInterval(() => {
      const elapsed = performance.now() - startTime
      const clamped = Math.min(elapsed, durationMs)
      onFrame(clamped)
      onProgress?.(clamped / durationMs)

      if (elapsed >= durationMs) {
        clearInterval(intervalId)
        recorder.stop()
        stream.getTracks().forEach((t) => t.stop())
      }
    }, intervalMs)
  })
}
