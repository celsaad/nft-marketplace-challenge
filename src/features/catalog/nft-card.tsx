import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/contracts/catalog'
import { FavoriteButton } from '@/features/favorites/favorite-button'
import { useT } from '@/lib/i18n'
import { compare } from '@/lib/money/eth'
import { EthAmount } from '@/ui/eth'
import { Skeleton } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'
import { NftImage } from '@/ui/nft-image'

/** Card frame shared by the real card and its skeleton, so loading never shifts the layout. */
const frame = 'relative rounded-3xl bg-card p-1 md:rounded-md md:px-3 md:pt-3 md:pb-3'
const imageRadius = 'rounded-[1.25rem] md:rounded-lg'

export const CARD_IMAGE_SIZES = '(min-width: 1024px) 260px, (min-width: 768px) 30vw, 45vw'

export function NftCard({
  nft,
  priority = false,
  className,
}: {
  nft: NftSummary
  priority?: boolean
  className?: string
}) {
  const t = useT()
  // A Previous Price is shown only while the current Price is lower (GLOSSARY: Previous Price).
  const dropped = nft.previousPrice !== null && compare(nft.price, nft.previousPrice) < 0
  return (
    <article className={cn('group relative flex flex-col', className)} data-testid="nft-card">
      <div className={frame}>
        <NftImage
          image={nft.image}
          alt={nft.imageAlt}
          sizes={CARD_IMAGE_SIZES}
          priority={priority}
          className={cn(
            imageRadius,
            'transition-transform duration-300 motion-safe:group-hover:scale-[1.02]',
          )}
        />
        {nft.rare && (
          <span className="absolute top-5 left-1 rounded-tl-[1.25rem] bg-primary px-2 py-1 text-xs font-medium tracking-wide text-primary-foreground uppercase md:hidden">
            {t('catalog.card.rare')}
          </span>
        )}
        {nft.soldOut && (
          <span className="absolute right-2 bottom-2 rounded-full bg-background/85 px-2 py-0.5 text-xs font-bold text-foreground md:right-4 md:bottom-4">
            {t('catalog.card.soldOut')}
          </span>
        )}
        {/* Above the stretched link, so the heart stays its own target. */}
        <FavoriteButton
          nftId={nft.id}
          nftName={nft.name}
          className="absolute top-2 right-2 z-10 md:top-4 md:right-4"
        />
      </div>
      <div className="flex flex-col gap-0.5 px-2 pt-2 md:px-0 md:pt-3">
        <h3 className="truncate text-sm md:text-[0.8125rem]">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {nft.name}
          </Link>
        </h3>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-bold text-primary md:text-[0.8125rem]">
          <span className="sr-only">{t('catalog.card.price')}: </span>
          <EthAmount value={nft.price} />
          {dropped && nft.previousPrice && (
            <span className="font-normal text-subtle-foreground">
              <span className="sr-only">{t('catalog.card.previousPrice')}: </span>
              <s>
                <EthAmount value={nft.previousPrice} />
              </s>
            </span>
          )}
        </p>
      </div>
    </article>
  )
}

export function NftCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)} data-testid="nft-card-skeleton">
      <div className={frame}>
        <Skeleton className={cn('aspect-square w-full', imageRadius)} />
      </div>
      {/* Same 20px text rows as the real card. */}
      <div className="flex flex-col gap-0.5 px-2 pt-2 md:px-0 md:pt-3">
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-1/3" />
        </div>
      </div>
    </div>
  )
}
