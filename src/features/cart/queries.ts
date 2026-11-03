// Cart and Quote query options. The shell reads the item count; the Purchase screens read the
// Cart and the Quote (the server's authority for every amount, ADR 0003).
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { queryClient } from '@/app/query/client'
import { keys } from '@/app/query/keys'
import { useSessionStore } from '@/app/session/store'
import type { Network } from '@/contracts/common'

export const cartQuery = (collectorId: string | null) =>
  queryOptions({
    queryKey: keys.cart(collectorId),
    queryFn: ({ signal }) => api.cart.get({ signal }),
    staleTime: 10_000,
  })

/** Item count for the header badge; 0 until the Cart has loaded. */
export function useCartCount(): number {
  const collectorId = useSessionStore((s) => s.collectorId)
  const { data } = useQuery({ ...cartQuery(collectorId), select: (cart) => cart.itemCount })
  return data ?? 0
}

export function useCart() {
  const collectorId = useSessionStore((s) => s.collectorId)
  return useQuery(cartQuery(collectorId))
}

/**
 * A Quote is a POST (the server prices the Cart right now), but it reads like a query: it is
 * refetched whenever the Cart changes, a realtime event invalidates it, or the Network changes.
 */
export const quoteQuery = (collectorId: string | null, paymentNetwork: Network) =>
  queryOptions({
    queryKey: keys.quote(collectorId, paymentNetwork),
    queryFn: async () => {
      const quote = await api.quotes.create({ paymentNetwork })
      // A Quote that found changes has also brought the Cart in line (sold-out lines removed,
      // quantities capped), so the cached Cart is now behind.
      if (quote.issues.length > 0) void queryClient.invalidateQueries({ queryKey: keys.cart(collectorId) })
      return quote
    },
    staleTime: 15_000,
  })

/** The Quote for the current Cart; disabled while the Cart is empty (nothing to price). */
export function useQuote(paymentNetwork: Network, enabled: boolean) {
  const collectorId = useSessionStore((s) => s.collectorId)
  return useQuery({ ...quoteQuery(collectorId, paymentNetwork), enabled })
}
