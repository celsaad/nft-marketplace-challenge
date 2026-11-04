// "NFT EM DESTAQUE / OFERTA LIMITADA" under the desktop sidebar. It is a real NFT (the Figma's
// Sage Nomad), so the card links to its detail and disappears if the catalog doesn't have it.
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { nftQuery } from '@/features/nft/queries'
import { useT } from '@/lib/i18n'
import { Skeleton } from '@/ui/feedback'
import { NftImage } from '@/ui/nft-image'

export const FEATURED_NFT_ID = 'nft_sage-nomad-009'

export function FeaturedNft() {
  const t = useT()
  const { data, isPending } = useQuery({ ...nftQuery(FEATURED_NFT_ID), retry: false })
  if (!isPending && !data) return null
  return (
    <section aria-labelledby="featured-title" className="flex flex-col">
      <div className="rounded-t-md bg-card px-3 pt-4 pb-6">
        <h2 id="featured-title" className="flex flex-col gap-1">
          <span className="text-lg font-bold tracking-wide text-highlight uppercase md:text-2xl">
            {t('catalog.featured.kicker')}
          </span>
          <span className="pl-5 text-base font-bold tracking-wide uppercase md:text-[22px]">
            {t('catalog.featured.title')}
          </span>
        </h2>
      </div>
      {data ? (
        <Link
          to="/nft/$nftId"
          params={{ nftId: data.id }}
          aria-label={t('catalog.featured.cta', { name: data.name })}
          className="-mt-3 block overflow-hidden rounded-xl"
        >
          <NftImage
            image={data.image}
            alt={data.imageAlt}
            sizes="310px"
            className="rounded-xl transition-transform duration-300 motion-safe:hover:scale-[1.02]"
          />
        </Link>
      ) : (
        <Skeleton className="-mt-3 aspect-square w-full rounded-xl" />
      )}
    </section>
  )
}
