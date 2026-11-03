// Where the filter form lives: the desktop sidebar applies each change at once; on smaller
// screens a Sheet holds a draft (focus trapped, Esc closes, focus returns to the button) and
// applies it all on "Aplicar". Both push a history entry and reset the page.
import { SlidersHorizontalIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import type { Category } from '@/contracts/catalog'
import type { Network } from '@/contracts/common'
import { useT } from '@/lib/i18n'
import type { Eth } from '@/lib/money/eth'
import { cn } from '@/ui/lib/utils'
import { Button } from '@/ui/primitives/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/ui/primitives/sheet'
import { useCatalogResults } from './catalog-results'
import { FilterPanel, type FilterValue } from './filter-panel'
import { toggle } from './search'
import { SearchField } from './search-field'
import { useCatalogSearch } from './use-catalog-search'

export function FilterSidebar({ className }: { className?: string }) {
  const t = useT()
  const { search, setFilters } = useCatalogSearch()
  const { data } = useCatalogResults()
  return (
    <section
      aria-label={t('catalog.filters.title')}
      className={cn('flex flex-col gap-6 rounded-md bg-card px-5 py-6', className)}
    >
      <SearchField
        inputClassName="h-10 rounded-md bg-background text-sm pl-10"
        className="[&>svg]:left-3 [&>svg]:size-4"
      />
      <FilterPanel
        facets={data?.facets}
        value={search}
        onToggleCategory={(c) => void setFilters({ category: toggle(search.category, c) })}
        onToggleNetwork={(n) => void setFilters({ network: toggle(search.network, n) })}
        onPriceApply={(minPrice, maxPrice) => void setFilters({ minPrice, maxPrice })}
      />
    </section>
  )
}

const activeCount = (v: FilterValue) =>
  (v.category?.length ?? 0) + (v.network?.length ?? 0) + (v.minPrice || v.maxPrice ? 1 : 0)

export function FilterSheet({ className }: { className?: string }) {
  const t = useT()
  const { search, setFilters } = useCatalogSearch()
  const { data } = useCatalogResults()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterValue>({})
  /** Bumped by "Limpar filtros" so the slider restarts from the full range. */
  const [cleared, setCleared] = useState(0)
  const applied: FilterValue = {
    category: search.category,
    network: search.network,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
  }
  const count = activeCount(applied)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Every opening starts from what is applied; closing without "Aplicar" discards the draft.
        if (next) setDraft(applied)
        setOpen(next)
      }}
    >
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={count ? t('catalog.filters.openCount', { count }) : t('catalog.filters.open')}
          className={cn(
            'relative grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary-hover to-primary text-primary-foreground shadow-md',
            className,
          )}
        >
          <SlidersHorizontalIcon aria-hidden className="size-5" />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background"
            >
              {count}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(22rem,100%)] gap-0 overflow-y-auto bg-card"
      >
        <SheetClose
          aria-label={t('catalog.nft.close')}
          className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-surface-raised hover:text-foreground"
        >
          <XIcon aria-hidden className="size-5" />
        </SheetClose>
        <SheetHeader className="pr-14">
          <SheetTitle>{t('catalog.filters.title')}</SheetTitle>
          <SheetDescription>{t('catalog.filters.description')}</SheetDescription>
        </SheetHeader>
        <form
          id="catalog-filter-form"
          className="px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault()
            void setFilters(draft)
            setOpen(false)
          }}
        >
          <FilterPanel
            facets={data?.facets}
            value={draft}
            priceKey={`${applied.minPrice}-${applied.maxPrice}-${cleared}`}
            onToggleCategory={(c: Category) => setDraft((d) => ({ ...d, category: toggle(d.category, c) }))}
            onToggleNetwork={(n: Network) => setDraft((d) => ({ ...d, network: toggle(d.network, n) }))}
            onPriceChange={(minPrice: Eth | undefined, maxPrice: Eth | undefined) =>
              setDraft((d) => ({ ...d, minPrice, maxPrice }))
            }
          />
        </form>
        <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t border-border bg-card">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => {
              setDraft({})
              setCleared((n) => n + 1)
            }}
          >
            {t('catalog.filters.clear')}
          </Button>
          <Button type="submit" form="catalog-filter-form" className="flex-1 font-bold">
            {t('catalog.filters.apply')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/** The mobile/tablet bar above the hero (Figma): search plus the filter button. */
export function MobileCatalogBar({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <SearchField className="flex-1" />
      <FilterSheet />
    </div>
  )
}
