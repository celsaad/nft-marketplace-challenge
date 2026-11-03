// The catalog's URL state (spec §Catálogo): the URL is the source of truth for search, filters,
// sort and page. These helpers keep it canonical: defaults are left out, so the same view always
// has the same URL and the same query key.
import type { CatalogQuery } from '@/contracts/catalog'

export type CatalogSearch = CatalogQuery & { favorites?: boolean }

/** What a filter change can touch; anything else (page) is derived. */
export type FilterPatch = Partial<Omit<CatalogQuery, 'page'>>

const isEmpty = (value: unknown) =>
  value === undefined || value === '' || (Array.isArray(value) && value.length === 0)

/** The exact query sent to the API (and used as the query key): no defaults, no empty values. */
export function toApiQuery(search: CatalogSearch): CatalogQuery {
  const query: CatalogQuery = {
    q: search.q?.trim() || undefined,
    category: search.category?.length ? search.category.toSorted() : undefined,
    network: search.network?.length ? search.network.toSorted() : undefined,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    tab: search.tab === 'all' ? undefined : search.tab,
    sort: search.sort === 'recent' ? undefined : search.sort,
    page: search.page === 1 ? undefined : search.page,
  }
  return Object.fromEntries(Object.entries(query).filter(([, v]) => !isEmpty(v))) as CatalogQuery
}

/** Applies a filter change. Any filter change sends the Collector back to page 1. */
export function applyFilters(search: CatalogSearch, patch: FilterPatch): CatalogSearch {
  return toUrlSearch({ ...search, ...patch, page: undefined })
}

export function goToPage(search: CatalogSearch, page: number): CatalogSearch {
  return toUrlSearch({ ...search, page })
}

/** Canonical URL search: the API query plus the Favorites view flag. */
export function toUrlSearch(search: CatalogSearch): CatalogSearch {
  return { ...toApiQuery(search), ...(search.favorites ? { favorites: true } : {}) }
}

/** True when anything narrows the results (used for "clear filters"). */
export function hasFilters(search: CatalogSearch): boolean {
  const { page: _page, sort: _sort, tab: _tab, ...filters } = toApiQuery(search)
  return Object.keys(filters).length > 0
}

/** Clears search and filters, keeping the tab and sort the Collector chose. */
export function clearFilters(search: CatalogSearch): CatalogSearch {
  return toUrlSearch({ tab: search.tab, sort: search.sort, favorites: search.favorites })
}

export function toggle<T>(list: readonly T[] | undefined, value: T): T[] {
  const current = list ?? []
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}
