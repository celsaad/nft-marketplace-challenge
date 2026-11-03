// The result grid and every state it can be in: first load (shimmer cards with the real cards'
// dimensions), refreshing (previous page stays, dimmed, with a hint), empty, error, out of range.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CATALOG_PAGE_SIZE } from '@/contracts/catalog'
import { useT } from '@/lib/i18n'
import { EmptyState, ErrorState, LoadingRegion, RefreshingHint } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'
import { Button } from '@/ui/primitives/button'
import { CatalogPagination } from './catalog-pagination'
import { NftCard, NftCardSkeleton } from './nft-card'
import { catalogQuery } from './queries'
import { type CatalogSearch, clearFilters, hasFilters, toApiQuery, toUrlSearch } from './search'
import { useCatalogSearch } from './use-catalog-search'

export const gridClass = 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-5 md:gap-y-8'
/** Mobile cards are staggered like the Figma: every second column sits lower. */
export const staggerClass = (index: number) => (index % 2 === 1 ? 'max-md:translate-y-8' : undefined)

/** The catalog query for the current URL, shared by the grid, the sidebar and the filter Sheet. */
export function useCatalogResults() {
  const { search } = useCatalogSearch()
  return useQuery({ ...catalogQuery(toApiQuery(search)), placeholderData: keepPreviousData })
}

export function SkeletonGrid({ count = CATALOG_PAGE_SIZE }: { count?: number }) {
  return (
    <LoadingRegion className={cn(gridClass, 'max-md:pb-8')}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
        <NftCardSkeleton key={i} className={staggerClass(i)} />
      ))}
    </LoadingRegion>
  )
}

export function CatalogResults() {
  const t = useT()
  const { search } = useCatalogSearch()
  const query = useCatalogResults()
  const { data } = query

  if (query.isPending) return <SkeletonGrid />
  if (query.isError && !data) {
    return (
      <ErrorState
        error={query.error}
        title={t('catalog.results.error')}
        onRetry={() => void query.refetch()}
      />
    )
  }
  if (!data) return null

  const summary =
    data.total === 1 ? t('catalog.results.summaryOne') : t('catalog.results.summary', { total: data.total })

  return (
    <div className="flex flex-col gap-8">
      {/* Fixed-height row: the hint appears without moving the grid. Announces new result counts. */}
      <div className="-mt-4 flex h-5 items-center justify-between gap-2 text-xs text-subtle-foreground">
        <p aria-live="polite" aria-atomic="true">
          {summary}
          {data.totalPages > 1 && (
            <span className="sr-only">
              {' — '}
              {t('catalog.results.page', { page: data.page, pages: data.totalPages })}
            </span>
          )}
        </p>
        <RefreshingHint active={query.isPlaceholderData} />
      </div>

      {data.items.length === 0 ? (
        <EmptyResults search={search} total={data.total} />
      ) : (
        <ul
          aria-busy={query.isPlaceholderData || undefined}
          className={cn(gridClass, 'max-md:pb-8 transition-opacity', query.isPlaceholderData && 'opacity-60')}
        >
          {data.items.map((nft, i) => (
            <li key={nft.id} className={staggerClass(i)}>
              {/* The first row is above the fold on every layout and holds the LCP image. */}
              <NftCard nft={nft} priority={i < 3} />
            </li>
          ))}
        </ul>
      )}

      <CatalogPagination page={data.page} pages={data.totalPages} />
    </div>
  )
}

function EmptyResults({ search, total }: { search: CatalogSearch; total: number }) {
  const t = useT()
  if (total > 0) {
    // A bookmarked page past the end (the catalog shrank): offer the first page.
    return (
      <EmptyState title={t('catalog.results.pageOutOfRange')}>
        <Button asChild variant="outline">
          <Link to="/" search={toUrlSearch({ ...search, page: undefined })} resetScroll={false}>
            {t('catalog.results.firstPage')}
          </Link>
        </Button>
      </EmptyState>
    )
  }
  if (!hasFilters(search)) {
    return <EmptyState title={t('catalog.results.emptyCatalog')} />
  }
  return (
    <EmptyState title={t('catalog.results.emptyTitle')}>
      <p className="text-sm text-muted-foreground">{t('catalog.results.emptyBody')}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link to="/" search={clearFilters(search)} resetScroll={false}>
          {t('catalog.filters.clear')}
        </Link>
      </Button>
    </EmptyState>
  )
}
