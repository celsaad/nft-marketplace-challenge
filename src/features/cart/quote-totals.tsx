// Subtotal, discount, Network Fee and total, always from the Quote (ADR 0003): the client never
// computes the amounts the Collector pays.
import type { Quote } from '@/contracts/purchase'
import { useT } from '@/lib/i18n'
import { formatEth, isZero } from '@/lib/money/eth'
import { EthAmount } from '@/ui/eth'
import { LoadingRegion, Skeleton } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'

export function QuoteTotals({
  quote,
  className,
  size = 'default',
}: {
  quote: Quote | undefined
  className?: string
  /** `large` is the mobile cart's bigger type. */
  size?: 'default' | 'large'
}) {
  const t = useT()
  if (!quote) return <QuoteTotalsSkeleton className={className} />
  const row = cn(
    'flex items-baseline justify-between gap-4',
    size === 'large' ? 'text-[15px] [&>dd]:text-base' : 'text-[15px]',
    // Desktop (Figma): labels 15 px, amounts 18 px.
    'md:text-[15px] md:[&>dd]:text-lg',
  )
  return (
    <dl className={cn('flex flex-col gap-3', className)} data-testid="quote-totals">
      <div className={row}>
        <dt>{t('purchase.summary.subtotal')}</dt>
        <dd data-testid="quote-subtotal">
          <EthAmount value={quote.subtotal} />
        </dd>
      </div>
      <div className={row}>
        <dt>
          {quote.coupon
            ? t('purchase.summary.discountCode', { code: quote.coupon.code })
            : t('purchase.summary.discount')}
        </dt>
        <dd className="whitespace-nowrap tabular-nums" data-testid="quote-discount">
          (-) {isZero(quote.discount) ? '0.00' : formatEth(quote.discount)}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <div className={row}>
          <dt>{t('purchase.summary.networkFee')}</dt>
          <dd data-testid="quote-fee">
            <EthAmount value={quote.networkFee} />
          </dd>
        </div>
        <p className="self-end text-xs text-highlight">{t('purchase.summary.estimated')}</p>
      </div>
      <div
        className={cn(
          'flex items-baseline justify-between gap-4 font-bold',
          'text-base',
          'md:[&>dd]:text-lg',
        )}
      >
        <dt>{t('purchase.summary.total')}</dt>
        <dd className="text-highlight" data-testid="quote-total">
          <EthAmount value={quote.total} />
        </dd>
      </div>
    </dl>
  )
}

/** Same footprint as the totals, so nothing jumps when the Quote arrives. */
export function QuoteTotalsSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion className={cn('flex flex-col gap-4', className)}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex justify-between gap-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
      <div className="flex justify-between gap-4 pt-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-28" />
      </div>
    </LoadingRegion>
  )
}
