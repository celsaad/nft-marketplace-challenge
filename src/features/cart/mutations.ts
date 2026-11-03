// Cart mutations. The Purchase slice owns and extends this module; `useAddToCart` is shared with
// the Catalog slice (NFT detail "Comprar") and keeps this signature.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { keys } from '@/app/query/keys'
import { useSessionStore } from '@/app/session/store'
import type { AddCartLineInput } from '@/contracts/purchase'

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
