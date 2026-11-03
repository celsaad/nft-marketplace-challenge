// Query keys (module-design §6). Public data is shared by everyone; private data is nested under
// the Collector's id, so one Collector's cache entries can never match another's, and a Session
// change removes the whole 'private' branch at once.
import type { CatalogQuery } from '@/contracts/catalog'
import type { Network } from '@/contracts/common'

export const keys = {
  public: ['public'] as const,
  catalog: (query: CatalogQuery) => ['public', 'catalog', query] as const,
  catalogAll: ['public', 'catalog'] as const,
  nft: (id: string) => ['public', 'nft', id] as const,
  nftAll: ['public', 'nft'] as const,
  reviews: (id: string) => ['public', 'reviews', id] as const,

  private: ['private'] as const,
  guest: ['guest'] as const,
  me: (collectorId: string) => ['private', collectorId, 'me'] as const,
  favorites: (collectorId: string) => ['private', collectorId, 'favorites'] as const,
  wallets: (collectorId: string) => ['private', collectorId, 'wallets'] as const,
  order: (collectorId: string, orderId: string) => ['private', collectorId, 'order', orderId] as const,

  /** The Cart belongs to the Collector, or to the Guest before login. */
  cart: (collectorId: string | null) =>
    collectorId ? (['private', collectorId, 'cart'] as const) : (['guest', 'cart'] as const),
  quote: (collectorId: string | null, network: Network) =>
    collectorId
      ? (['private', collectorId, 'quote', network] as const)
      : (['guest', 'quote', network] as const),
  quoteAll: (collectorId: string | null) =>
    collectorId ? (['private', collectorId, 'quote'] as const) : (['guest', 'quote'] as const),
}
