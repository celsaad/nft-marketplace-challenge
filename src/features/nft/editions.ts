// Edition and quantity rules for the purchase panel. The server enforces the same limits
// (AVAILABILITY_CONFLICT / QUANTITY_LIMIT); these only keep the UI from offering the impossible.
import type { Edition } from '@/contracts/catalog'

export const isAvailable = (edition: Edition) => edition.available > 0

/** Edition label as drawn in the Figma chips: 1/1, 1/10, 1/50 or ABERTA. */
export const editionLabel = (edition: Edition, openLabel: string) =>
  edition.size === null ? openLabel.toUpperCase() : `1/${edition.size}`

/** The Edition shown first: the first one that can still be bought, else the first. */
export function defaultEdition(editions: readonly Edition[]): Edition | undefined {
  return editions.find(isAvailable) ?? editions[0]
}

/** How many units one Cart Line may take: Availability capped by the per-order limit. */
export function maxQuantity(edition: Edition | undefined, maxPerOrder: number): number {
  return edition ? Math.max(0, Math.min(edition.available, maxPerOrder)) : 0
}

/** Keeps a chosen quantity inside 1…max (it can shrink live when Availability drops). */
export function clampQuantity(quantity: number, max: number): number {
  return Math.max(1, Math.min(quantity, Math.max(max, 1)))
}

/** Why the stepper stops here, if it does: the Edition runs out first, or the order limit. */
export function limitReason(
  quantity: number,
  edition: Edition | undefined,
  maxPerOrder: number,
): 'available' | 'order' | null {
  const max = maxQuantity(edition, maxPerOrder)
  if (!edition || max === 0 || quantity < max) return null
  return edition.available < maxPerOrder ? 'available' : 'order'
}
