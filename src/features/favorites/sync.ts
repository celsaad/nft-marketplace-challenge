// Serializes Favorite toggles per NFT (docs/decisions.md §Interaction safety): at most one request
// per NFT is in flight, the last intent wins, and a failure rolls back to the last state the server
// confirmed. Pure apart from the injected `send`, so it is unit-tested without React or HTTP.

export interface FavoriteSyncDeps {
  send(nftId: string, favorite: boolean): Promise<void>
  /** A request failed: the UI must show `rollbackTo` again and say why. */
  onFailure(nftId: string, error: unknown, rollbackTo: boolean): void
  /** The server now agrees with the Collector's last intent. */
  onSettled?(nftId: string, favorite: boolean): void
  onPendingChange?(nftId: string, pending: boolean): void
}

interface Slot {
  desired: boolean
  confirmed: boolean
}

export interface FavoriteSync {
  /** Records the latest intent; `current` is what the server last confirmed when nothing is queued. */
  set(nftId: string, favorite: boolean, current: boolean): void
  isPending(nftId: string): boolean
}

export function createFavoriteSync(deps: FavoriteSyncDeps): FavoriteSync {
  const slots = new Map<string, Slot>()

  async function drain(nftId: string, slot: Slot) {
    deps.onPendingChange?.(nftId, true)
    try {
      while (slot.desired !== slot.confirmed) {
        const target = slot.desired
        try {
          // Sequential on purpose: one request per NFT at a time keeps the server's order ours.
          // oxlint-disable-next-line no-await-in-loop
          await deps.send(nftId, target)
          slot.confirmed = target
        } catch (error) {
          slot.desired = slot.confirmed
          deps.onFailure(nftId, error, slot.confirmed)
          return
        }
      }
      deps.onSettled?.(nftId, slot.confirmed)
    } finally {
      slots.delete(nftId)
      deps.onPendingChange?.(nftId, false)
    }
  }

  return {
    set(nftId, favorite, current) {
      const existing = slots.get(nftId)
      if (existing) {
        existing.desired = favorite
        return
      }
      if (favorite === current) return
      const slot = { desired: favorite, confirmed: current }
      slots.set(nftId, slot)
      void drain(nftId, slot)
    },
    isPending: (nftId) => slots.has(nftId),
  }
}
