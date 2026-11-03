// Catalog query options. The key is exactly the query sent to the API, so out-of-order answers
// can never land on the wrong view: each answer belongs to its own key, and leaving a view aborts
// its request through the signal.
import { queryOptions } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { keys } from '@/app/query/keys'
import type { CatalogQuery } from '@/contracts/catalog'

export const catalogQuery = (query: CatalogQuery) =>
  queryOptions({
    queryKey: keys.catalog(query),
    queryFn: ({ signal }) => api.catalog.list(query, { signal }),
  })
