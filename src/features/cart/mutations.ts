// Cart mutations. The Purchase slice owns and extends this module; `useAddToCart` is shared with
// the Catalog slice (NFT detail "Comprar") and keeps this signature.
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { keys } from '@/app/query/keys'
import { useSessionStore } from '@/app/session/store'
import type { AddCartLineInput, Cart } from '@/contracts/purchase'

export function useAddToCart() {
  const queryClient = useQueryClient()
  const collectorId = useSessionStore((s) => s.collectorId)
  return useMutation({
    mutationFn: (input: AddCartLineInput) => api.cart.addLine(input),
    onSuccess: (cart) => {
      queryClient.setQueryData(keys.cart(collectorId), cart)
      // Any Quote for the old Cart is now stale.
      void queryClient.invalidateQueries({ queryKey: keys.quoteAll(collectorId) })
    },
  })
}

/**
 * Stores a Cart the server answered with, unless a newer one is already cached: responses to
 * concurrent changes (two lines edited at once) can arrive out of order, and the server's
 * `version` tells which is the latest.
 */
function storeCart(queryClient: QueryClient, collectorId: string | null, cart: Cart) {
  queryClient.setQueryData<Cart>(keys.cart(collectorId), (cached) =>
    cached && cached.id === cart.id && cached.version > cart.version ? cached : cart,
  )
  void queryClient.invalidateQueries({ queryKey: keys.quoteAll(collectorId) })
}

function useCartChange<Variables>(mutationFn: (variables: Variables) => Promise<Cart>, scope?: string) {
  const queryClient = useQueryClient()
  const collectorId = useSessionStore((s) => s.collectorId)
  return useMutation({
    mutationFn,
    // Changes to one line run one after another, so the last value sent is the one that sticks.
    scope: scope ? { id: scope } : undefined,
    onSuccess: (cart) => storeCart(queryClient, collectorId, cart),
  })
}

export const useSetQuantity = (lineId: string) =>
  useCartChange((quantity: number) => api.cart.setQuantity(lineId, quantity), `cart-line:${lineId}`)

export const useRemoveLine = () => useCartChange((lineId: string) => api.cart.removeLine(lineId))

export const useApplyCoupon = () => useCartChange((code: string) => api.cart.applyCoupon(code))

export const useRemoveCoupon = () => useCartChange(() => api.cart.removeCoupon())
