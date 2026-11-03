// Cart query options. The Purchase slice extends this module (mutations, quote); the shell
// only reads the item count.
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { keys } from '@/app/query/keys'
import { useSessionStore } from '@/app/session/store'

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
