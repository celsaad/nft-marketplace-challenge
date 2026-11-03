// Quote issues name Cart Lines by id, but a sold-out line has already left the Cart by the time the
// issue is shown. Remember every name seen so the message can still say which NFT it was.
import { useState } from 'react'
import type { Cart } from '@/contracts/purchase'

export function useLineNames(cart: Cart | undefined): ReadonlyMap<string, string> {
  const [known, setKnown] = useState<ReadonlyMap<string, string>>(() => new Map())
  const lines = cart?.lines ?? []
  // Adjusting state while rendering (React's "store info from previous renders" pattern).
  if (lines.some((line) => known.get(line.id) !== line.nft.name)) {
    setKnown(new Map([...known, ...lines.map((line) => [line.id, line.nft.name] as const)]))
  }
  return known
}

/** "1/50" for a numbered Edition, the localized "ABERTA" for an Open Edition. */
export const editionLabel = (size: number | null, open: string) => (size === null ? open : `1/${size}`)
