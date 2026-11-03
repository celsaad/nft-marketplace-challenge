// "Detalhes do NFT" / "Avaliações de colecionadores (N)". Reviews are read-only fixtures from the
// API (docs/decisions.md §UI) and load only when their tab is opened.
import { useQuery } from '@tanstack/react-query'
import { StarIcon } from 'lucide-react'
import type { NftDetail } from '@/contracts/catalog'
import { useLocale, useT } from '@/lib/i18n'
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/tabs'
import { editionLabel } from './editions'
import { reviewsQuery } from './queries'

export const shortAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`
export const royalties = (bps: number) => `${bps / 100}%`

export function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.round(value)
  return (
    <span aria-hidden className={cn('inline-flex gap-0.5', className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          // biome-ignore lint/suspicious/noArrayIndexKey: five fixed positions
          key={i}
          className={cn('size-3.5', i < full ? 'fill-primary text-primary' : 'text-subtle-foreground')}
        />
      ))}
    </span>
  )
}

function Details({ nft }: { nft: NftDetail }) {
  const t = useT()
  const network = t(`catalog.network.${nft.network}`)
  const edition = nft.editions[0] ? editionLabel(nft.editions[0], t('catalog.nft.editionOpen')) : ''
  const params = {
    name: nft.name,
    edition,
    collection: nft.collection.name,
    network,
    creator: nft.creator,
    royalties: royalties(nft.royaltiesBps),
    address: shortAddress(nft.contractAddress),
  }
  return (
    <div className="flex flex-col gap-5 text-xs leading-relaxed text-muted-foreground md:text-[0.8125rem] md:leading-[1.65]">
      <p>{t('catalog.nft.details.0', params)}</p>
      <p>{t('catalog.nft.details.1', params)}</p>
      <dl className="flex flex-col gap-3">
        {(
          [
            ['networkTitle', 'networkBody'],
            ['contractTitle', 'contractBody'],
            ['royaltiesTitle', 'royaltiesBody'],
          ] as const
        ).map(([title, body]) => (
          <div key={title}>
            <dt className="font-bold text-foreground">{t(`catalog.nft.${title}`)}</dt>
            <dd>{t(`catalog.nft.${body}`, params)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Reviews({ nftId }: { nftId: string }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const query = useQuery(reviewsQuery(nftId))
  if (query.isPending) {
    return (
      <LoadingRegion className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </LoadingRegion>
    )
  }
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        title={t('catalog.nft.reviewsError')}
        onRetry={() => void query.refetch()}
      />
    )
  }
  if (query.data.length === 0) return <EmptyState title={t('catalog.nft.reviewsEmpty')} />
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {query.data.map((review) => (
          <li key={review.id} className="flex flex-col gap-1.5 rounded-md bg-card p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <Stars value={review.rating} />
              <span className="sr-only">{t('catalog.nft.rating', { average: review.rating })}</span>
              <span className="font-bold">{t('catalog.nft.reviewBy', { author: review.author })}</span>
              <time dateTime={review.createdAt} className="text-subtle-foreground">
                {date.format(new Date(review.createdAt))}
              </time>
            </div>
            <p className="text-sm text-muted-foreground">{review.text}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-subtle-foreground">
        {t('catalog.nft.reviewsShown', { count: query.data.length })}
      </p>
    </div>
  )
}

const trigger =
  'h-auto flex-none rounded-none border-none px-0 pb-2 text-sm font-normal text-foreground shadow-none hover:text-primary-hover data-[state=active]:font-bold data-[state=active]:text-primary md:text-base dark:text-foreground dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-primary after:bottom-0! after:h-[3px]! after:bg-primary'

export function DetailTabs({ nft }: { nft: NftDetail }) {
  const t = useT()
  return (
    <Tabs defaultValue="details" className="gap-5">
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-8 overflow-x-auto rounded-none border-b border-border p-0"
      >
        <TabsTrigger value="details" className={trigger}>
          {t('catalog.nft.tabDetails')}
        </TabsTrigger>
        <TabsTrigger value="reviews" className={trigger}>
          {t('catalog.nft.tabReviews', { count: nft.rating.count })}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details">
        <Details nft={nft} />
      </TabsContent>
      <TabsContent value="reviews">
        <Reviews nftId={nft.id} />
      </TabsContent>
    </Tabs>
  )
}
