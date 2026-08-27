import { create } from 'zustand'

export type ExportDuration = 10 | 15 | 30 | 60

interface PlaybackState {
  isPlaying: boolean
  progress: number // 0..1 within the selected range
  speedMultiplier: number
  isRecording: boolean
  recordingProgress: number // 0..1
  isResolvingRegions: boolean
  exportDurationSec: ExportDuration
  exportedBlobUrl: string | null
  exportError: string | null

  setIsPlaying: (v: boolean) => void
  setProgress: (v: number) => void
  setSpeedMultiplier: (v: number) => void
  setIsRecording: (v: boolean) => void
  setRecordingProgress: (v: number) => void
  setIsResolvingRegions: (v: boolean) => void
  setExportDurationSec: (v: ExportDuration) => void
  setExportedBlobUrl: (v: string | null) => void
  setExportError: (v: string | null) => void
  resetPlayback: () => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  isPlaying: false,
  progress: 0,
  speedMultiplier: 1,
  isRecording: false,
  recordingProgress: 0,
  isResolvingRegions: false,
  exportDurationSec: 15,
  exportedBlobUrl: null,
  exportError: null,

  setIsPlaying: (v) => set({ isPlaying: v }),
  setProgress: (v) => set({ progress: v }),
  setSpeedMultiplier: (v) => set({ speedMultiplier: v }),
  setIsRecording: (v) => set({ isRecording: v }),
  setRecordingProgress: (v) => set({ recordingProgress: v }),
  setIsResolvingRegions: (v) => set({ isResolvingRegions: v }),
  setExportDurationSec: (v) => set({ exportDurationSec: v }),
  setExportedBlobUrl: (v) => set({ exportedBlobUrl: v }),
  setExportError: (v) => set({ exportError: v }),
  resetPlayback: () => set({ isPlaying: false, progress: 0, isRecording: false, recordingProgress: 0 }),
}))
