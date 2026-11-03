// "Mais desta coleção": other NFTs of the same Collection. The API filters by text, not by
// Collection, so it searches the Collection's name and keeps exact Collection matches only.
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { NftDetail } from '@/contracts/catalog'
import { CarouselDots } from '@/features/catalog/carousel-dots'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { catalogQuery } from '@/features/catalog/queries'
import { useT } from '@/lib/i18n'
import { LoadingRegion } from '@/ui/feedback'
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from '@/ui/primitives/carousel'

const item = 'basis-1/2 md:basis-1/3 lg:basis-1/5'

export function MoreFromCollection({ nft }: { nft: NftDetail }) {
  const t = useT()
  const [api, setApi] = useState<CarouselApi>()
  const query = useQuery({
    ...catalogQuery({ q: nft.collection.name }),
    select: (page) => page.items.filter((n) => n.collection.id === nft.collection.id && n.id !== nft.id),
  })

  // Supplementary: on failure the section simply isn't shown; the page itself is fine.
  if (query.isError || (query.data && query.data.length === 0)) return null

  return (
    <section aria-labelledby="more-title" className="flex flex-col gap-6">
      <h2 id="more-title" className="border-b border-border pb-2 text-sm font-bold text-primary md:text-base">
        {t('catalog.nft.more')}
      </h2>
      {query.data ? (
        <Carousel setApi={setApi} opts={{ align: 'start' }} aria-labelledby="more-title">
          <CarouselContent className="-ml-6">
            {query.data.map((n, i) => (
              <CarouselItem
                key={n.id}
                className={`${item} pl-6`}
                aria-label={`${i + 1} / ${query.data.length}`}
              >
                <NftCard nft={n} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselDots
            api={api}
            variant="ring"
            label={(n) => t('catalog.nft.moreGoTo', { n })}
            className="mt-6 justify-center"
          />
        </Carousel>
      ) : (
        <LoadingRegion className="flex gap-6 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <NftCardSkeleton
              key={i}
              className="w-[calc(50%-12px)] shrink-0 md:w-[calc(33.33%-16px)] lg:w-[calc(20%-19.2px)]"
            />
          ))}
        </LoadingRegion>
      )}
    </section>
  )
}
