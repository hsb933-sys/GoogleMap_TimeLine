import { parseTimelineJson } from '../lib/timelineParser'

self.onmessage = (event: MessageEvent<string>) => {
  try {
    const raw = JSON.parse(event.data)
    const result = parseTimelineJson(raw)
    self.postMessage({ ok: true, result })
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
