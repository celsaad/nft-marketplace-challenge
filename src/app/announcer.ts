// Messages the UI must announce (aria-live + toast): realtime changes and mutation results.
// Holds data, not text; the UI turns each announcement into words in the current locale.
import { create } from 'zustand'
import type { Announcement as RealtimeAnnouncement } from './realtime/reconcile'

export type Announcement =
  | RealtimeAnnouncement
  | { kind: 'session-expired' }
  | { kind: 'realtime-offline' }
  | { kind: 'realtime-online' }

interface AnnouncerState {
  queue: (Announcement & { id: number })[]
}

let nextId = 1

export const useAnnouncer = create<AnnouncerState>()(() => ({ queue: [] }))

export function announce(announcement: Announcement) {
  useAnnouncer.setState((s) => ({ queue: [...s.queue, { ...announcement, id: nextId++ }].slice(-10) }))
}

export function dismissAnnouncement(id: number) {
  useAnnouncer.setState((s) => ({ queue: s.queue.filter((a) => a.id !== id) }))
}
