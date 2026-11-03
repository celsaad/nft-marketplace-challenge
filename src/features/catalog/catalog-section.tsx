// The market section (`#mercado`): tabs, sort, the desktop filter sidebar with the featured NFT,
// and the results. Everything it shows is derived from the URL.
import { Link } from '@tanstack/react-router'
import { CATALOG_SORTS, CATALOG_TABS, type CatalogQuery } from '@/contracts/catalog'
import { FavoritesResults } from '@/features/favorites/favorites-results'
import { useT } from '@/lib/i18n'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/tabs'
import { FilterSidebar } from './catalog-filters'
import { CatalogResults } from './catalog-results'
import { FeaturedNft } from './featured-nft'
import { useCatalogSearch } from './use-catalog-search'

type Tab = NonNullable<CatalogQuery['tab']>
type Sort = NonNullable<CatalogQuery['sort']>

function SortSelect() {
  const t = useT()
  const { search, setFilters } = useCatalogSearch()
  return (
    <div className="flex items-center gap-1 text-xs md:text-[0.8125rem]">
      <span id="catalog-sort-label" className="text-foreground">
        {t('catalog.sort.label')}
      </span>
      <Select
        value={search.sort ?? 'recent'}
        onValueChange={(sort) => void setFilters({ sort: sort as Sort })}
      >
        <SelectTrigger
          aria-labelledby="catalog-sort-label catalog-sort-value"
          className="h-8 border-none bg-transparent px-1 text-xs text-foreground shadow-none md:text-[0.8125rem] dark:bg-transparent dark:hover:bg-surface-raised [&_svg:not([class*='text-'])]:text-foreground"
        >
          <span id="catalog-sort-value">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {CATALOG_SORTS.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {t(`catalog.sort.${sort}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const tabTrigger =
  'h-auto flex-none rounded-none border-none px-0 pb-1.5 text-sm text-foreground shadow-none hover:text-primary-hover data-[state=active]:font-bold data-[state=active]:text-primary md:text-[0.8125rem] dark:text-foreground dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-primary after:bottom-0! after:bg-primary'

function CatalogTabs() {
  const t = useT()
  const { search, setFilters } = useCatalogSearch()
  const tab = search.tab ?? 'all'
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => void setFilters({ tab: next as Tab })}
      activationMode="manual"
      className="gap-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <TabsList
          variant="line"
          aria-label={t('catalog.tabs.label')}
          className="h-auto gap-3 overflow-x-auto p-0 md:gap-4"
        >
          {CATALOG_TABS.map((value) => (
            <TabsTrigger key={value} value={value} className={tabTrigger}>
              {t(`catalog.tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <SortSelect />
      </div>
      {CATALOG_TABS.map((value) => (
        <TabsContent key={value} value={value} tabIndex={-1}>
          {/* Radix mounts only the active panel, so only one results grid ever exists. */}
          <CatalogResults />
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function CatalogSection() {
  const t = useT()
  const { search } = useCatalogSearch()

  if (search.favorites) {
    return (
      <section
        id="mercado"
        aria-labelledby="mercado-title"
        className="mx-auto w-full max-w-[1200px] scroll-mt-4 px-4 md:px-6"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 id="mercado-title" className="text-lg font-bold text-primary">
            {t('catalog.favorites.title')}
          </h1>
          <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t('catalog.favorites.browse')}
          </Link>
        </div>
        <FavoritesResults />
      </section>
    )
  }

  return (
    <section
      id="mercado"
      aria-labelledby="mercado-title"
      className="mx-auto w-full max-w-[1200px] scroll-mt-4 px-4 md:px-6"
    >
      <h2 id="mercado-title" className="sr-only">
        {t('catalog.section.title')}
      </h2>
      <div className="grid gap-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-12">
        <div className="hidden flex-col gap-6 lg:flex">
          <FilterSidebar />
          <FeaturedNft />
        </div>
        <div className="min-w-0">
          <CatalogTabs />
        </div>
      </div>
    </section>
  )
}
