import { useRef } from 'react'
import { useTimelineStore } from '../store/useTimelineStore'

export function UploadScreen() {
  const inputRef = useRef<HTMLInputElement>(null)
  const setParsing = useTimelineStore((s) => s.setParsing)
  const setParsed = useTimelineStore((s) => s.setParsed)
  const setError = useTimelineStore((s) => s.setError)
  const status = useTimelineStore((s) => s.status)
  const errorMessage = useTimelineStore((s) => s.errorMessage)
  const warnings = useTimelineStore((s) => s.warnings)

  function handleFile(file: File) {
    setParsing()
    const worker = new Worker(new URL('../workers/parseWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (
      e: MessageEvent<
        | {
            ok: true
            result: { points: unknown; minDate: Date | string | null; maxDate: Date | string | null; warnings: string[] }
          }
        | { ok: false; error: string }
      >,
    ) => {
      if (e.data.ok) {
        const { points, minDate, maxDate, warnings } = e.data.result
        setParsed({
          points: points as never,
          minDate: minDate ? new Date(minDate) : null,
          maxDate: maxDate ? new Date(maxDate) : null,
          warnings,
        })
      } else {
        setError(e.data.error)
      }
      worker.terminate()
    }
    worker.onerror = (e) => {
      setError(e.message)
      worker.terminate()
    }
    file.text().then((text) => worker.postMessage(text))
  }

  return (
    <div className="screen upload-screen">
      <h1>여행 타임라인 영상 만들기</h1>
      <p>
        Google Timeline.json 파일을 업로드하세요. 파일은 서버로 전송되지 않으며, 모든 처리는 이 브라우저 안에서만
        이루어집니다.
      </p>
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => inputRef.current?.click()}
      >
        {status === 'parsing' ? '파싱 중...' : '클릭하거나 파일을 여기로 끌어다 놓으세요'}
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </div>
      {errorMessage && <p className="error-banner">오류: {errorMessage}</p>}
      {warnings.length > 0 && (
        <p className="warning-banner">
          {warnings.length}개 구간을 해석하지 못해 건너뛰었습니다.
        </p>
      )}
    </div>
  )
}
