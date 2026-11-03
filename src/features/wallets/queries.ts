// Wallet queries and mutations. Marking a Wallet as Primary changes the others too, so every
// successful write refetches the whole list instead of patching one entry.
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { keys } from '@/app/query/keys'
import type { WalletInput } from '@/contracts/account'

export const walletsQuery = (collectorId: string) =>
  queryOptions({
    queryKey: keys.wallets(collectorId),
    queryFn: ({ signal }) => api.wallets.list({ signal }),
  })

export const useWallets = (collectorId: string) => useQuery(walletsQuery(collectorId))

export function useSaveWallet(collectorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: WalletInput }) =>
      id ? api.wallets.update(id, input) : api.wallets.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.wallets(collectorId) }),
  })
}
