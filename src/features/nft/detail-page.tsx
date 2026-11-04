// Detalhes do NFT. Works on direct access (the query fetches whatever the loader didn't), answers
// a nonexistent id with an in-page not-found, and follows realtime changes from the cache.
import { useQuery } from '@tanstack/react-query'
import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ChevronLeftIcon, MailIcon, StarIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { NftDetail } from '@/contracts/catalog'
import { FavoriteButton, FavoriteSignInDialog } from '@/features/favorites/favorite-button'
import { useT } from '@/lib/i18n'
import { formatEth } from '@/lib/money/eth'
import { EthAmount } from '@/ui/eth'
import { ErrorState, LoadingRegion, Skeleton } from '@/ui/feedback'
import { Button } from '@/ui/primitives/button'
import { SectionBoundary } from '@/ui/section-boundary'
import { notifyUnavailable } from '@/ui/unavailable'
import { DetailTabs, Stars } from './detail-tabs'
import { Gallery } from './gallery'
import { MoreFromCollection } from './more-from-collection'
import { EditionPicker, type Purchase, PurchasePanel, usePurchase } from './purchase'
import { isNotFound, nftQuery } from './queries'

const page = 'mx-auto w-full max-w-[1248px] px-4 md:px-6'

export function NftDetailPage({ nftId }: { nftId: string }) {
  const t = useT()
  const query = useQuery(nftQuery(nftId))

  if (query.isPending) return <DetailSkeleton />
  if (query.isError) {
    if (isNotFound(query.error)) return <NftNotFound />
    return (
      <div className={`${page} py-16`}>
        <ErrorState
          error={query.error}
          title={t('catalog.nft.loadError')}
          onRetry={() => void query.refetch()}
        />
      </div>
    )
  }
  // Remount per NFT so the Edition and quantity never carry over between pages.
  return <Detail key={query.data.id} nft={query.data} />
}

function Detail({ nft }: { nft: NftDetail }) {
  const t = useT()
  const purchase = usePurchase(nft)

  useEffect(() => {
    const previous = document.title
    document.title = `${nft.name} · Kurio`
    return () => {
      document.title = previous
    }
  }, [nft.name])

  return (
    <article className="flex flex-col gap-12 pb-28 md:gap-20 md:pb-20">
      <div className={`${page} flex flex-col gap-4 pt-4 md:pt-8`}>
        <MobileTopBar nft={nft} />
        <nav aria-label={t('catalog.nft.breadcrumb')} className="hidden md:block">
          <ol className="flex items-center gap-2 text-[0.8125rem] font-bold">
            <li>
              <Link to="/" className="hover:text-highlight">
                {t('catalog.nft.home')}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link to="/" hash="mercado" className="hover:text-highlight">
                {t('catalog.nft.market')}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="truncate font-normal text-muted-foreground">
              {nft.name}
            </li>
          </ol>
        </nav>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-8 lg:grid-cols-[minmax(0,575px)_minmax(0,1fr)]">
          <Gallery nft={nft} className="md:self-start" />
          <Info nft={nft} purchase={purchase} />
        </div>
      </div>

      <div className={page}>
        <SectionBoundary>
          <DetailTabs nft={nft} />
        </SectionBoundary>
      </div>
      <div className={page}>
        <SectionBoundary quiet>
          <MoreFromCollection nft={nft} />
        </SectionBoundary>
      </div>
      <FavoriteSignInDialog />
    </article>
  )
}

function MobileTopBar({ nft }: { nft: NftDetail }) {
  const t = useT()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const circle =
    'grid size-11 place-items-center rounded-full border border-border bg-card text-foreground hover:text-highlight'
  return (
    <div className="flex items-center justify-between md:hidden">
      {canGoBack ? (
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label={t('catalog.nft.back')}
          className={circle}
        >
          <ChevronLeftIcon aria-hidden className="size-5" />
        </button>
      ) : (
        <Link to="/" aria-label={t('catalog.nft.back')} className={circle}>
          <ChevronLeftIcon aria-hidden className="size-5" />
        </Link>
      )}
      <FavoriteButton nftId={nft.id} nftName={nft.name} className="size-11 border border-border bg-card" />
    </div>
  )
}

function Info({ nft, purchase }: { nft: NftDetail; purchase: Purchase }) {
  const t = useT()
  const announcement = useLiveChanges(nft, purchase)
  const share = 'grid size-6 place-items-center text-foreground hover:text-highlight'
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-3">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-bold md:text-[1.75rem]">{nft.name}</h1>
        <p className="flex shrink-0 items-center gap-1 rounded-full border border-primary px-2.5 py-1 text-sm md:hidden">
          <StarIcon aria-hidden className="size-4 fill-primary text-highlight" />
          <span aria-hidden>
            {nft.rating.average.toFixed(1)}({nft.rating.count})
          </span>
          <span className="sr-only">
            {t('catalog.nft.rating', { average: nft.rating.average.toFixed(1) })},{' '}
            {t('catalog.nft.reviewsCount', { count: nft.rating.count })}
          </span>
        </p>
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-3 border-b border-border pb-3 md:flex">
        <EthAmount value={nft.price} className="text-xl font-bold text-highlight md:text-[22px]" />
        <p className="flex items-center gap-2 text-[0.8125rem] md:text-[15px]">
          <Stars value={nft.rating.average} />
          <span className="sr-only">
            {t('catalog.nft.rating', { average: nft.rating.average.toFixed(1) })}.
          </span>
          {t('catalog.nft.reviewsCount', { count: nft.rating.count })}
        </p>
      </div>
      {/* Realtime Price/Availability changes, spoken; the numbers themselves update in place. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      <section aria-labelledby="about-title" className="flex flex-col gap-2">
        <h2 id="about-title" className="hidden text-[15px] font-bold md:block">
          {t('catalog.nft.about')}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground md:leading-[1.65]">{nft.description}</p>
      </section>

      <EditionPicker nft={nft} purchase={purchase} />
      <PurchasePanel nft={nft} purchase={purchase} className="max-md:order-last md:mt-1" />

      <dl className="flex flex-col gap-2 text-sm text-muted-foreground md:text-[15px]">
        {(
          [
            ['tokenId', `#${nft.tokenId.padStart(4, '0')}`],
            ['collection', nft.collection.name],
            ['attributes', nft.attributes.join(', ')],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex flex-wrap gap-x-2">
            <dt>{t(`catalog.nft.${label}`)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="hidden items-center gap-3 md:flex">
        <p className="text-[0.8125rem] font-bold md:text-[15px]">{t('catalog.nft.share')}</p>
        <ul className="flex items-center gap-2">
          <li>
            <button
              type="button"
              onClick={notifyUnavailable}
              aria-label={t('catalog.nft.shareOn', { network: 'LinkedIn' })}
              className={share}
            >
              <span aria-hidden className="text-sm font-black">
                in
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={notifyUnavailable}
              aria-label={t('catalog.nft.shareEmail')}
              className={share}
            >
              <MailIcon aria-hidden className="size-4" />
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={notifyUnavailable}
              aria-label={t('catalog.nft.shareOn', { network: 'X' })}
              className={share}
            >
              <span aria-hidden className="text-sm font-black">
                𝕏
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}

/** Words for realtime changes to what this page shows (ADR 0002 patches the cache; we narrate). */
function useLiveChanges(nft: NftDetail, purchase: Purchase) {
  const t = useT()
  const edition = purchase.edition
  const [seen, setSeen] = useState({
    price: nft.price,
    editionId: edition?.id,
    available: edition?.available,
  })
  const [message, setMessage] = useState('')
  const changed =
    nft.price !== seen.price || edition?.id !== seen.editionId || edition?.available !== seen.available
  if (changed) {
    setSeen({ price: nft.price, editionId: edition?.id, available: edition?.available })
    if (nft.price !== seen.price) {
      setMessage(t('catalog.nft.priceChanged', { name: nft.name, price: formatEth(nft.price) }))
    } else if (edition && edition.id === seen.editionId) {
      setMessage(
        t('catalog.nft.availabilityChanged', { edition: purchase.label(), count: edition.available }),
      )
    }
  }
  return message
}

function NftNotFound() {
  const t = useT()
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p aria-hidden className="text-5xl font-bold text-highlight">
        404
      </p>
      <h1 className="text-2xl font-bold">{t('catalog.nft.notFoundTitle')}</h1>
      <p className="text-muted-foreground">{t('catalog.nft.notFoundBody')}</p>
      <Button asChild>
        <Link to="/" hash="mercado">
          {t('catalog.nft.notFoundBack')}
        </Link>
      </Button>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <LoadingRegion className={`${page} flex flex-col gap-4 pt-4 pb-28 md:pt-8`}>
      <Skeleton className="hidden h-5 w-48 md:block" />
      <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-[minmax(0,575px)_minmax(0,1fr)]">
        <div className="flex gap-6">
          <div className="hidden w-[88px] shrink-0 flex-col gap-3 md:flex">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
          <div className="flex-1 md:rounded-md md:bg-card md:p-4">
            <Skeleton className="aspect-square w-full rounded-3xl md:rounded-xl" />
          </div>
        </div>
        <div className="flex flex-col gap-4" data-testid="detail-skeleton">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-1/2" />
        </div>
      </div>
    </LoadingRegion>
  )
}
