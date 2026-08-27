import { useRegionNames } from '../hooks/useRegionNames'
import type { TimelinePoint } from '../types/timeline'

interface Props {
  points: TimelinePoint[]
}

export function RegionVisitsTable({ points }: Props) {
  const { isResolving, resolveProgress, rows } = useRegionNames(points)

  if (isResolving) {
    const percent = Math.round(resolveProgress * 100)
    return (
      <div className="region-table-wrap">
        <h2>방문 지역</h2>
        <p className="region-table-status">방문 지역 조회 중... ({percent}%)</p>
        <div className="region-progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="region-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    )
  }
  if (rows.length === 0) return null

  return (
    <div className="region-table-wrap">
      <h2>방문 지역</h2>
      <div className="region-table-scroll">
        <table className="region-table">
          <thead>
            <tr>
              <th>나라</th>
              <th>시</th>
              <th>방문 횟수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.country || '-'}</td>
                <td>{row.city}</td>
                <td>{row.visitCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
