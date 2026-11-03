// Order query options. `order.updated` events invalidate this key (app/realtime); polling while
// pending is the fallback for when the socket is down (ADR 0002: events are hints, REST is truth).
import { queryOptions } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { keys } from '@/app/query/keys'

export const ORDER_POLL_MS = 3000

export const orderQuery = (collectorId: string, orderId: string) =>
  queryOptions({
    queryKey: keys.order(collectorId, orderId),
    queryFn: ({ signal }) => api.orders.get(orderId, { signal }),
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? ORDER_POLL_MS : false),
  })
