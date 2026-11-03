// The checkout draft (docs/decisions.md §State management): what the Collector typed and chose,
// kept in sessionStorage so a Session Expiry mid-checkout costs nothing. It is restored only for
// the same Collector (the one who signs back in); anyone else's draft is discarded on read.
import type { BuyerDetails } from '@/contracts/purchase'

export interface CheckoutDraft {
  collectorId: string
  values: Partial<BuyerDetails>
  useOtherWallet: boolean
  walletId: string | null
  /** The Wallet the Collector approved a Wallet Connection for. */
  connectedWalletId: string | null
}

const STORAGE_KEY = 'kurio.checkout.draft'

export function readDraft(collectorId: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as CheckoutDraft
    if (draft.collectorId === collectorId) return draft
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  } catch {
    return null
  }
}

export function saveDraft(draft: CheckoutDraft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Storage unavailable: the form still works, it just can't be restored.
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}
