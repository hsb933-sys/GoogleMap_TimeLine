import { useRegionNames } from '../hooks/useRegionNames'
import type { TimelinePoint } from '../types/timeline'

interface Props {
  points: TimelinePoint[]
}

export function VisitedRegionsList({ points }: Props) {
  const { summaries, isResolving } = useRegionNames(points)

  if (summaries.length === 0) return null

  return (
    <div className="region-list-wrap">
      <h2>방문 지역{isResolving && ' (확인 중...)'}</h2>
      <ul className="region-list">
        {summaries.map((region) => (
          <li key={region.clusterId} className="region-list-item">
            <span className="region-name">{region.name}</span>
            {region.visitCount > 1 && <span className="region-visit-badge">{region.visitCount}번 방문</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
