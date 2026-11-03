// Reads and writes the home route's search params. Filter changes push a history entry (so
// back/forward walks through them); typing in the search box replaces it (one entry per search).
import { getRouteApi } from '@tanstack/react-router'
import { useCallback } from 'react'
import { applyFilters, type CatalogSearch, type FilterPatch, goToPage, toUrlSearch } from './search'

const home = getRouteApi('/')

export function useCatalogSearch() {
  const search = home.useSearch() as CatalogSearch
  const navigate = home.useNavigate()

  const setFilters = useCallback(
    (patch: FilterPatch, { replace = false } = {}) =>
      navigate({
        search: (prev) => applyFilters(prev as CatalogSearch, patch),
        replace,
        resetScroll: false,
      }),
    [navigate],
  )
  const setPage = useCallback(
    (page: number) =>
      navigate({ search: (prev) => goToPage(prev as CatalogSearch, page), resetScroll: false }),
    [navigate],
  )
  const replaceAll = useCallback(
    (next: CatalogSearch) => navigate({ search: toUrlSearch(next), resetScroll: false }),
    [navigate],
  )

  return { search, setFilters, setPage, replaceAll }
}
