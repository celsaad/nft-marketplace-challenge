// Registered Wallets and the simulated Wallet Connection used at checkout. The server remembers the
// connection; the client only shows its last known state for the chosen Wallet.
import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/app/api/endpoints'
import { type ApiError, toApiError } from '@/app/api/errors'
import { keys } from '@/app/query/keys'
import type { Wallet } from '@/contracts/account'
import type { Network } from '@/contracts/common'

export const walletsQuery = (collectorId: string) =>
  queryOptions({
    queryKey: keys.wallets(collectorId),
    queryFn: ({ signal }) => api.wallets.list({ signal }),
  })

export const useWallets = (collectorId: string) => useQuery(walletsQuery(collectorId))

/** The Wallet to pay with on a Network: the Primary Wallet if it is there, else the first one. */
export function walletFor(wallets: readonly Wallet[], network: Network): Wallet | null {
  const onNetwork = wallets.filter((w) => w.network === network)
  return onNetwork.find((w) => w.isPrimary) ?? onNetwork[0] ?? null
}

export const shortAddress = (address: string) =>
  address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address

export type ConnectionStatus = 'idle' | 'connecting' | 'approved' | 'rejected' | 'error'

export function useWalletConnection(initialConnectedId: string | null) {
  const [connectedId, setConnectedId] = useState<string | null>(initialConnectedId)
  const [failure, setFailure] = useState<{ walletId: string; error: ApiError } | null>(null)
  const connect = useMutation({
    mutationFn: (walletId: string) => api.wallets.connect(walletId),
    onMutate: () => setFailure(null),
    onSuccess: (connection) => setConnectedId(connection.walletId),
    onError: (error, walletId) => {
      setConnectedId((current) => (current === walletId ? null : current))
      setFailure({ walletId, error: toApiError(error) })
    },
  })
  const disconnect = useMutation({
    mutationFn: (walletId: string) => api.wallets.disconnect(walletId),
    onSuccess: () => setConnectedId(null),
  })

  const statusOf = (walletId: string | null): ConnectionStatus => {
    if (!walletId) return 'idle'
    if (connect.isPending && connect.variables === walletId) return 'connecting'
    if (connectedId === walletId) return 'approved'
    if (failure?.walletId === walletId) return failure.error.code === 'WALLET_REJECTED' ? 'rejected' : 'error'
    return 'idle'
  }

  return {
    connectedId,
    statusOf,
    connect: (walletId: string) => connect.mutate(walletId),
    disconnect: (walletId: string) => disconnect.mutate(walletId),
    disconnecting: disconnect.isPending,
  }
}
