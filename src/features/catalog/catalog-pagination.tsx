// Numbered pagination (docs/decisions.md §UI) made of real links: every page has its own URL,
// so it opens in a new tab, survives refresh and walks back/forward.
import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { type CatalogSearch, goToPage } from './search'

/** Page numbers to show, with null for a gap: 1 … 4 5 6 … 12. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const middle = [page - 1, page, page + 1].filter((p) => p > 1 && p < pages)
  const list: (number | null)[] = [1]
  if ((middle[0] ?? pages) > 2) list.push(null)
  list.push(...middle)
  if ((middle.at(-1) ?? 1) < pages - 1) list.push(null)
  list.push(pages)
  return list
}

const cell =
  'grid size-8 place-items-center rounded-sm border border-border text-xs tabular-nums transition-colors hover:border-primary hover:text-primary md:size-7'

const to = (page: number) => (prev: CatalogSearch) => goToPage(prev, page)

const scrollToCatalog = () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById('mercado')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
}

export function CatalogPagination({ page, pages }: { page: number; pages: number }) {
  const t = useT()
  if (pages <= 1) return null
  return (
    <nav aria-label={t('catalog.pagination.label')} className="flex justify-center md:justify-end">
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <Link
              to="/"
              search={to(page - 1)}
              resetScroll={false}
              onClick={scrollToCatalog}
              aria-label={t('catalog.pagination.previous')}
              className={cell}
            >
              <ChevronLeftIcon aria-hidden className="size-4" />
            </Link>
          </li>
        )}
        {pageWindow(page, pages).map((p, i, list) =>
          p === null ? (
            <li key={`gap-before-${list[i + 1]}`} aria-hidden className="px-1 text-xs text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                to="/"
                search={to(p)}
                resetScroll={false}
                onClick={scrollToCatalog}
                aria-label={t('catalog.pagination.page', { page: p })}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  cell,
                  p === page &&
                    'border-primary bg-primary font-bold text-primary-foreground hover:text-primary-foreground',
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        {page < pages && (
          <li>
            <Link
              to="/"
              search={to(page + 1)}
              resetScroll={false}
              onClick={scrollToCatalog}
              aria-label={t('catalog.pagination.next')}
              className={cell}
            >
              <ChevronRightIcon aria-hidden className="size-4" />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  )
}
