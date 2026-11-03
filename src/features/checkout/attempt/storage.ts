// The active Checkout Attempt survives a refresh in sessionStorage (docs/decisions.md §State
// management): its Idempotency Key, the Quote hash, the Order id once known, and the exact request
// that was sent, so a retry after a reload is byte-for-byte the same and resolves to the same Order.
import type { CreateOrderInput } from '@/contracts/purchase'

export interface SavedAttempt {
  collectorId: string
  key: string
  quoteHash: string | null
  orderId: string | null
  /** The Order request already sent whose outcome may be unknown; null once settled or never sent. */
  input: CreateOrderInput | null
}

const STORAGE_KEY = 'kurio.checkout.attempt'

function storage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** The saved attempt, if it belongs to this Collector; another Collector's is discarded. */
export function readAttempt(collectorId: string): SavedAttempt | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedAttempt
    if (saved.collectorId === collectorId && typeof saved.key === 'string') return saved
    clearAttempt()
    return null
  } catch {
    return null
  }
}

export function saveAttempt(attempt: SavedAttempt) {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(attempt))
  } catch {
    // Without storage the attempt still works; it just can't survive a refresh.
  }
}

export function clearAttempt() {
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}

/** Forgets the attempt once its Order has reached a terminal state. */
export function clearAttemptForOrder(orderId: string) {
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (raw && (JSON.parse(raw) as SavedAttempt).orderId === orderId) clearAttempt()
  } catch {
    // Nothing to clear.
  }
}
