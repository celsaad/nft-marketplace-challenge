// Catalog search, filters, faceted counts, sorting and pagination over the NFT records.
import {
  CATALOG_PAGE_SIZE,
  CATEGORIES,
  type CatalogPage,
  type CatalogQuery,
  type NftDetail,
  type NftSummary,
} from '@/contracts/catalog'
import { NETWORKS } from '@/contracts/common'
import { compare, eth } from '@/lib/money/eth'
import type { NftRecord } from './state'

/** "Novos lançamentos": listed within this window of the newest listing (not of today, so it never empties). */
const NEW_WINDOW_MS = 14 * 86_400_000
/** "Em alta": popularity at or above this score. */
const TRENDING_THRESHOLD = 500

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export const isSoldOut = (nft: NftRecord) => nft.editions.every((e) => e.available === 0)

export function toSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    name: nft.name,
    tokenId: nft.tokenId,
    image: nft.image,
    imageAlt: nft.imageAlt,
    price: nft.price,
    previousPrice: nft.previousPrice,
    network: nft.network,
    category: nft.category,
    collection: nft.collection,
    rare: nft.rare,
    listedAt: nft.listedAt,
    soldOut: isSoldOut(nft),
    version: nft.version,
  }
}

export function toDetail({ trending: _t, ...nft }: NftRecord): NftDetail {
  return { ...nft, soldOut: isSoldOut(nft as NftRecord) }
}

type Facet = 'category' | 'network' | 'price'

/** Applies every filter except `skip`, so a facet's counts ignore its own selection. */
function matches(nft: NftRecord, query: CatalogQuery, newestListing: number, skip?: Facet): boolean {
  if (query.q && !normalize(`${nft.name} ${nft.collection.name}`).includes(normalize(query.q))) return false
  if (skip !== 'category' && query.category?.length && !query.category.includes(nft.category)) return false
  if (skip !== 'network' && query.network?.length && !query.network.includes(nft.network)) return false
  if (skip !== 'price' && query.minPrice && compare(nft.price, query.minPrice) < 0) return false
  if (skip !== 'price' && query.maxPrice && compare(nft.price, query.maxPrice) > 0) return false
  if (query.tab === 'new' && Date.parse(nft.listedAt) < newestListing - NEW_WINDOW_MS) return false
  if (query.tab === 'trending' && nft.trending < TRENDING_THRESHOLD) return false
  return true
}

const SORTERS: Record<NonNullable<CatalogQuery['sort']>, (a: NftRecord, b: NftRecord) => number> = {
  recent: (a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt),
  'price-asc': (a, b) => compare(a.price, b.price) || a.name.localeCompare(b.name, 'pt-BR'),
  'price-desc': (a, b) => compare(b.price, a.price) || a.name.localeCompare(b.name, 'pt-BR'),
  name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
}

export function queryCatalog(nfts: NftRecord[], query: CatalogQuery): CatalogPage {
  const newestListing = Math.max(...nfts.map((n) => Date.parse(n.listedAt)))
  const results = nfts
    .filter((n) => matches(n, query, newestListing))
    .toSorted(SORTERS[query.sort ?? 'recent'])

  const count = <K extends string>(keys: readonly K[], facet: Facet, key: (n: NftRecord) => K) => {
    const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
    for (const n of nfts) if (matches(n, query, newestListing, facet)) counts[key(n)]++
    return counts
  }
  const priced = nfts.filter((n) => matches(n, query, newestListing, 'price')).map((n) => n.price)
  const sortedPrices = priced.toSorted(compare)

  const page = query.page ?? 1
  const start = (page - 1) * CATALOG_PAGE_SIZE
  return {
    items: results.slice(start, start + CATALOG_PAGE_SIZE).map(toSummary),
    page,
    pageSize: CATALOG_PAGE_SIZE,
    total: results.length,
    totalPages: Math.ceil(results.length / CATALOG_PAGE_SIZE),
    facets: {
      categories: count(CATEGORIES, 'category', (n) => n.category),
      networks: count(NETWORKS, 'network', (n) => n.network),
      priceRange: {
        min: sortedPrices[0] ?? eth('0'),
        max: sortedPrices.at(-1) ?? eth('0'),
      },
    },
  }
}
