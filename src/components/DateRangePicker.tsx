import { useMemo, useState } from 'react'
import { useTimelineStore } from '../store/useTimelineStore'

function toInputValue(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function DateRangePicker() {
  const minDate = useTimelineStore((s) => s.minDate)
  const maxDate = useTimelineStore((s) => s.maxDate)
  const points = useTimelineStore((s) => s.points)
  const selectedFrom = useTimelineStore((s) => s.selectedFrom)
  const selectedTo = useTimelineStore((s) => s.selectedTo)
  const setSelectedRange = useTimelineStore((s) => s.setSelectedRange)
  const setStep = useTimelineStore((s) => s.setStep)

  const [fromStr, setFromStr] = useState(selectedFrom ? toInputValue(selectedFrom) : '')
  const [toStr, setToStr] = useState(selectedTo ? toInputValue(selectedTo) : '')

  const minStr = minDate ? toInputValue(minDate) : undefined
  const maxStr = maxDate ? toInputValue(maxDate) : undefined

  const fromMs = fromStr ? new Date(fromStr).getTime() : NaN
  const toMs = toStr ? new Date(`${toStr}T23:59:59.999`).getTime() : NaN
  const valid = !Number.isNaN(fromMs) && !Number.isNaN(toMs) && fromMs <= toMs

  const selectedCount = useMemo(() => {
    if (!valid) return 0
    return points.filter((p) => p.timestamp >= fromMs && p.timestamp <= toMs).length
  }, [points, fromMs, toMs, valid])

  function handleContinue() {
    if (!valid) return
    setSelectedRange(new Date(fromMs), new Date(toMs))
    setStep('studio')
  }

  return (
    <div className="screen range-screen">
      <h1>기간 선택</h1>
      <p>영상으로 만들 과거~현재 구간을 선택하세요.</p>
      <div className="range-fields">
        <label>
          시작일
          <input type="date" value={fromStr} min={minStr} max={maxStr} onChange={(e) => setFromStr(e.target.value)} />
        </label>
        <label>
          종료일
          <input type="date" value={toStr} min={minStr} max={maxStr} onChange={(e) => setToStr(e.target.value)} />
        </label>
      </div>
      {!valid && <p className="warning-banner">시작일은 종료일보다 앞서야 합니다.</p>}
      {valid && <p>선택된 지점 수: {selectedCount}개</p>}
      <div className="btn-row">
        <button onClick={() => setStep('overview')}>← 뒤로</button>
        <button className="primary-btn" disabled={!valid || selectedCount === 0} onClick={handleContinue}>
          미리보기로 이동 →
        </button>
      </div>
    </div>
  )
}
