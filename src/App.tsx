import 'leaflet/dist/leaflet.css'
import './App.css'
import { useTimelineStore } from './store/useTimelineStore'
import { UploadScreen } from './components/UploadScreen'
import { OverviewMap } from './components/OverviewMap'
import { DateRangePicker } from './components/DateRangePicker'
import { PlaybackStudio } from './components/PlaybackStudio'

// When embedded (e.g. a blog's iframe), some mobile skins shrink/mis-render
// the iframe or interfere with tap handling for the file picker. Offer an
// always-working escape hatch to open the tool full-page instead of debugging
// every possible host page's iframe behavior.
const isEmbedded = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

function App() {
  const step = useTimelineStore((s) => s.step)

  return (
    <div className="app">
      {isEmbedded && (
        <a className="open-new-tab-banner" href={window.location.href} target="_blank" rel="noopener noreferrer">
          모바일에서 업로드가 잘 안되나요? 새 탭에서 크게 열기 ↗
        </a>
      )}
      {step === 'upload' && <UploadScreen />}
      {step === 'overview' && <OverviewMap />}
      {step === 'range' && <DateRangePicker />}
      {step === 'studio' && <PlaybackStudio />}
    </div>
  )
}

export default App
