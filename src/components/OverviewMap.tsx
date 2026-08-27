import { useMemo } from 'react'
import { MapContainer, Polyline, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet'
import { useTimelineStore } from '../store/useTimelineStore'
import { decimatePoints } from '../lib/decimatePoints'

// Rendering every raw point (a multi-year export can have 100k+) as SVG path
// vertices freezes the page; decimate down to a count Leaflet can draw smoothly.
const MAX_OVERVIEW_POINTS = 4000

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap()
  useMemo(() => {
    if (bounds) map.fitBounds(bounds, { padding: [30, 30] })
  }, [bounds, map])
  return null
}

export function OverviewMap() {
  const points = useTimelineStore((s) => s.points)
  const minDate = useTimelineStore((s) => s.minDate)
  const maxDate = useTimelineStore((s) => s.maxDate)
  const setStep = useTimelineStore((s) => s.setStep)

  const path = useMemo<LatLngTuple[]>(
    () => decimatePoints(points, MAX_OVERVIEW_POINTS).map((p) => [p.lat, p.lng]),
    [points],
  )
  const bounds = useMemo<LatLngBoundsExpression | null>(() => (path.length > 0 ? path : null), [path])

  return (
    <div className="screen overview-screen">
      <h1>전체 여행 기록</h1>
      <p>
        {minDate?.toLocaleDateString()} ~ {maxDate?.toLocaleDateString()} 사이 총 {points.length}개 지점
      </p>
      <div className="map-wrap">
        <MapContainer center={[20, 0]} zoom={2} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {path.length > 0 && <Polyline positions={path} color="#e63946" weight={3} />}
          {path.length > 0 && (
            <CircleMarker center={path[path.length - 1]} radius={6} pathOptions={{ color: '#1d3557', fillColor: '#1d3557', fillOpacity: 1 }} />
          )}
          <FitBounds bounds={bounds} />
        </MapContainer>
      </div>
      <button className="primary-btn" onClick={() => setStep('range')} disabled={points.length === 0}>
        기간 선택하기 →
      </button>
    </div>
  )
}
