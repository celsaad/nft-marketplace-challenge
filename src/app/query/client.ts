// The QueryClient and its cache/retry policy, set once here and documented in ARCHITECTURE.md.
import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '../api/errors'

const MAX_RETRIES = 2

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Catalog data changes through realtime events too, so a short staleness window is enough.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Retry only when nothing was decided server-side (503, network, timeout); never on 4xx.
      retry: (failureCount, error) => isApiError(error) && error.retryable && failureCount < MAX_RETRIES,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Mutations never retry on their own: Order creation recovers through the Checkout Attempt
      // (same Idempotency-Key), everything else through the UI's explicit "try again".
      retry: false,
    },
  },
})
