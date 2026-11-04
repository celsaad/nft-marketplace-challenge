// Início: hero, the market (tabs, filters, grid, pagination), promos and the journal.
import { FavoriteSignInDialog } from '@/features/favorites/favorite-button'
import { MobileCatalogBar } from './catalog-filters'
import { CatalogSection } from './catalog-section'
import { MintJournal, PromoCards } from './editorial'
import { Hero } from './hero'
import { useCatalogSearch } from './use-catalog-search'

export function HomePage() {
  const { search } = useCatalogSearch()
  return (
    <div className="flex flex-col gap-8 pt-4 pb-28 md:gap-16 md:pt-6 md:pb-20">
      {!search.favorites && (
        <>
          <MobileCatalogBar className="mx-auto w-full max-w-[1248px] px-4 md:px-6 lg:hidden" />
          <Hero />
        </>
      )}
      <CatalogSection />
      {!search.favorites && (
        <>
          <PromoCards />
          <MintJournal />
        </>
      )}
      <FavoriteSignInDialog />
    </div>
  )
}
