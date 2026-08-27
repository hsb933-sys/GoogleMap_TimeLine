import 'leaflet/dist/leaflet.css'
import './App.css'
import { useTimelineStore } from './store/useTimelineStore'
import { UploadScreen } from './components/UploadScreen'
import { OverviewMap } from './components/OverviewMap'
import { DateRangePicker } from './components/DateRangePicker'
import { PlaybackStudio } from './components/PlaybackStudio'

function App() {
  const step = useTimelineStore((s) => s.step)

  return (
    <div className="app">
      {step === 'upload' && <UploadScreen />}
      {step === 'overview' && <OverviewMap />}
      {step === 'range' && <DateRangePicker />}
      {step === 'studio' && <PlaybackStudio />}
    </div>
  )
}

export default App
