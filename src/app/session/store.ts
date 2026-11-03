// Session state the API client and realtime need outside React. Server data (the Collector's
// profile, Cart, …) lives in TanStack Query, never here (docs/decisions.md §State management).
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type SessionStatus = 'guest' | 'authenticated' | 'expired'

interface SessionState {
  status: SessionStatus
  token: string | null
  expiresAt: string | null
  collectorId: string | null
  /** Who was last signed in, kept through expiry so only they get their checkout draft back. */
  lastCollectorId: string | null
  /** The Guest Cart's id (X-Cart-Id) until the visitor logs in. */
  guestCartId: string | null
}

export const useSessionStore = create<SessionState>()(
  persist(
    (): SessionState => ({
      status: 'guest',
      token: null,
      expiresAt: null,
      collectorId: null,
      lastCollectorId: null,
      guestCartId: null,
    }),
    {
      name: 'kurio.session',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

export const getSession = () => useSessionStore.getState()
