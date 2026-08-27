import { useMemo, useRef } from 'react'
import { useTimelineStore } from '../store/useTimelineStore'
import { usePlaybackStore, type ExportDuration } from '../store/usePlaybackStore'
import { CanvasRecorder, type CanvasRecorderHandle } from './CanvasRecorder'
import { RegionVisitsTable } from './RegionVisitsTable'
import { isRecordingSupported } from '../lib/videoExporter'

const DURATIONS: ExportDuration[] = [10, 15, 30, 60]

export function PlaybackStudio() {
  const points = useTimelineStore((s) => s.points)
  const selectedFrom = useTimelineStore((s) => s.selectedFrom)
  const selectedTo = useTimelineStore((s) => s.selectedTo)
  const setStep = useTimelineStore((s) => s.setStep)

  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying)
  const progress = usePlaybackStore((s) => s.progress)
  const setProgress = usePlaybackStore((s) => s.setProgress)
  const exportDurationSec = usePlaybackStore((s) => s.exportDurationSec)
  const setExportDurationSec = usePlaybackStore((s) => s.setExportDurationSec)
  const isRecording = usePlaybackStore((s) => s.isRecording)
  const recordingProgress = usePlaybackStore((s) => s.recordingProgress)
  const isResolvingRegions = usePlaybackStore((s) => s.isResolvingRegions)
  const exportedBlobUrl = usePlaybackStore((s) => s.exportedBlobUrl)
  const setExportedBlobUrl = usePlaybackStore((s) => s.setExportedBlobUrl)
  const exportError = usePlaybackStore((s) => s.exportError)
  const setExportError = usePlaybackStore((s) => s.setExportError)

  const recorderRef = useRef<CanvasRecorderHandle>(null)

  const rangeFromMs = selectedFrom?.getTime() ?? 0
  const rangeToMs = selectedTo?.getTime() ?? 0
  const rangePoints = useMemo(
    () => points.filter((p) => p.timestamp >= rangeFromMs && p.timestamp <= rangeToMs),
    [points, rangeFromMs, rangeToMs],
  )
  const previewDurationMs = exportDurationSec * 1000

  const supported = isRecordingSupported()

  async function handleExport() {
    setExportError(null)
    if (exportedBlobUrl) {
      URL.revokeObjectURL(exportedBlobUrl)
      setExportedBlobUrl(null)
    }
    try {
      const blob = await recorderRef.current?.exportVideo()
      if (blob) setExportedBlobUrl(URL.createObjectURL(blob))
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="screen studio-screen">
      <h1>미리보기 & 영상 내보내기</h1>
      <p>
        {selectedFrom?.toLocaleDateString()} ~ {selectedTo?.toLocaleDateString()} · {rangePoints.length}개 지점
      </p>

      <CanvasRecorder
        ref={recorderRef}
        points={rangePoints}
        rangeFromMs={rangeFromMs}
        rangeToMs={rangeToMs}
        previewDurationMs={previewDurationMs}
      />

      <div className="transport">
        <button onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? '일시정지' : '재생'}</button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => {
            setIsPlaying(false)
            setProgress(Number(e.target.value))
          }}
        />
      </div>

      <div className="export-row">
        <label>
          영상 길이
          <select
            value={exportDurationSec}
            onChange={(e) => setExportDurationSec(Number(e.target.value) as ExportDuration)}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d}초
              </option>
            ))}
          </select>
        </label>
        <button className="primary-btn" onClick={handleExport} disabled={!supported || isRecording || isResolvingRegions}>
          {isResolvingRegions
            ? '지역 정보 확인 중...'
            : isRecording
              ? `녹화 중... ${Math.round(recordingProgress * 100)}%`
              : '영상 내보내기'}
        </button>
      </div>
      {(isRecording || isResolvingRegions) && (
        <p className="warning-banner">내보내는 동안 이 탭을 벗어나지 마세요. 다른 탭으로 전환하면 처리 속도가 느려질 수 있습니다.</p>
      )}

      {!supported && <p className="error-banner">이 브라우저는 영상 녹화를 지원하지 않습니다.</p>}
      {exportError && <p className="error-banner">내보내기 오류: {exportError}</p>}

      {exportedBlobUrl && (
        <div className="export-result">
          <video src={exportedBlobUrl} controls style={{ width: '100%', maxWidth: 800 }} />
          <a className="primary-btn" href={exportedBlobUrl} download="travel-recap.webm">
            travel-recap.webm 다운로드
          </a>
        </div>
      )}

      <div className="btn-row">
        <button onClick={() => setStep('range')}>← 기간 다시 선택</button>
      </div>

      <RegionVisitsTable points={rangePoints} />
    </div>
  )
}
