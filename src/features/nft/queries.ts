// NFT detail query options. Realtime `nft.updated` events patch the `nft` entry in place
// (app/realtime), so the page reads Price and Availability from here and stays live.
import { queryOptions } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { isApiError } from '@/app/api/errors'
import { keys } from '@/app/query/keys'

export const nftQuery = (id: string) =>
  queryOptions({
    queryKey: keys.nft(id),
    queryFn: ({ signal }) => api.catalog.get(id, { signal }),
  })

export const reviewsQuery = (id: string) =>
  queryOptions({
    queryKey: keys.reviews(id),
    queryFn: ({ signal }) => api.catalog.reviews(id, { signal }),
    staleTime: 5 * 60_000,
  })

export const isNotFound = (error: unknown) => isApiError(error) && error.kind === 'notFound'
