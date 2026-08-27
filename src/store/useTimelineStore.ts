import { create } from 'zustand'
import type { TimelinePoint } from '../types/timeline'

export type AppStep = 'upload' | 'overview' | 'range' | 'studio'

interface TimelineState {
  status: 'idle' | 'parsing' | 'ready' | 'error'
  points: TimelinePoint[]
  minDate: Date | null
  maxDate: Date | null
  warnings: string[]
  errorMessage: string | null
  step: AppStep
  selectedFrom: Date | null
  selectedTo: Date | null

  setParsing: () => void
  setParsed: (data: { points: TimelinePoint[]; minDate: Date | null; maxDate: Date | null; warnings: string[] }) => void
  setError: (message: string) => void
  setStep: (step: AppStep) => void
  setSelectedRange: (from: Date, to: Date) => void
  reset: () => void
}

export const useTimelineStore = create<TimelineState>((set) => ({
  status: 'idle',
  points: [],
  minDate: null,
  maxDate: null,
  warnings: [],
  errorMessage: null,
  step: 'upload',
  selectedFrom: null,
  selectedTo: null,

  setParsing: () => set({ status: 'parsing', errorMessage: null }),
  setParsed: ({ points, minDate, maxDate, warnings }) =>
    set({
      status: 'ready',
      points,
      minDate,
      maxDate,
      warnings,
      selectedFrom: minDate,
      selectedTo: maxDate,
      step: 'overview',
    }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  setStep: (step) => set({ step }),
  setSelectedRange: (from, to) => set({ selectedFrom: from, selectedTo: to }),
  reset: () =>
    set({
      status: 'idle',
      points: [],
      minDate: null,
      maxDate: null,
      warnings: [],
      errorMessage: null,
      step: 'upload',
      selectedFrom: null,
      selectedTo: null,
    }),
}))
