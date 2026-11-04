// Carrinho de NFTs (desktop and mobile Figma frames). Lines come from the Cart, every amount in
// the summary from the Quote; realtime changes reach both through query invalidation.
import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { CartLine } from '@/contracts/purchase'
import { useT } from '@/lib/i18n'
import { EmptyState, ErrorState, LoadingRegion, RefreshingHint, Skeleton } from '@/ui/feedback'
import { reportFailure } from '@/ui/form/report-failure'
import { MobileActionBar } from '@/ui/mobile-action-bar'
import { SectionBoundary } from '@/ui/section-boundary'
import { CartLineRow } from './cart-line'
import { COUPON_INPUT_ID, CouponForm } from './coupon-form'
import { useLineNames } from './line-names'
import { useLiveRegion } from './live-region'
import { useRemoveLine } from './mutations'
import { useCart, useQuote } from './queries'
import { QuoteIssuesNotice, useReportedIssues } from './quote-issues'
import { QuoteTotals, QuoteTotalsSkeleton } from './quote-totals'
import { Recommendations } from './recommendations'

/** The cart shows the Ethereum fee, as drawn; the Payment Network is chosen at checkout (ADR 0008). */
const CART_NETWORK = 'ethereum'

export function CartPage() {
  const t = useT()
  const cart = useCart()
  const lines = cart.data?.lines ?? []
  const hasLines = lines.length > 0
  const quote = useQuote(CART_NETWORK, hasLines)
  const names = useLineNames(cart.data)
  const { issues, dismiss } = useReportedIssues(quote.data)
  const { say, region } = useLiveRegion()
  const remove = useRemoveLine()
  const [removingId, setRemovingId] = useState<string | null>(null)

  const removeLine = (line: CartLine) => {
    setRemovingId(line.id)
    remove.mutate(line.id, {
      onSuccess: () => {
        const text = t('purchase.cart.removed', { name: line.nft.name })
        say(text)
        toast.success(text)
      },
      onError: (e) =>
        reportFailure(e, {
          onMessage: (key) => {
            say(t(key))
            toast.error(t(key))
          },
        }),
      onSettled: () => setRemovingId(null),
    })
  }

  // The Quote lags the Cart while a change is being re-priced: say so instead of showing old totals as final.
  const quotedUnits = quote.data?.lines.reduce((n, l) => n + l.quantity, 0)
  const repricing =
    hasLines && (quote.isFetching || (quotedUnits !== undefined && quotedUnits !== cart.data?.itemCount))

  return (
    <section className="mx-auto flex max-w-[1248px] flex-col gap-6 px-4 pt-6 pb-28 md:gap-4 md:px-6 md:pt-8 md:pb-16">
      <div className="relative flex items-center justify-center md:sr-only">
        <Link
          to="/"
          aria-label={t('purchase.back')}
          className="absolute left-0 grid size-12 place-items-center rounded-full bg-surface-raised text-highlight md:hidden"
        >
          <ChevronLeftIcon aria-hidden />
        </Link>
        <h1 className="text-xl font-bold">{t('purchase.cart.title')}</h1>
      </div>
      <nav aria-label="breadcrumb" className="hidden md:block">
        <ol className="flex items-center gap-2 text-sm font-bold">
          <li>
            <Link to="/" className="hover:text-primary-hover">
              {t('purchase.breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/" hash="mercado" className="hover:text-primary-hover">
              {t('purchase.breadcrumb.market')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{t('purchase.breadcrumb.cart')}</li>
        </ol>
      </nav>
      {region}

      {cart.isPending ? (
        <CartSkeleton />
      ) : cart.isError ? (
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
      ) : !hasLines ? (
        <div className="flex flex-col gap-4">
          <EmptyState title={t('purchase.cart.empty')}>
            <p className="text-sm text-muted-foreground">{t('purchase.cart.emptyBody')}</p>
            <Link to="/" hash="mercado" className="mt-2 font-bold text-highlight hover:text-primary-hover">
              {t('purchase.cart.explore')}
            </Link>
          </EmptyState>
          <QuoteIssuesNotice issues={issues} names={names} onDismiss={dismiss} />
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_300px] md:gap-12 lg:grid-cols-[minmax(0,1fr)_332px] lg:gap-[86px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div
              aria-hidden
              className="hidden grid-cols-[70px_minmax(0,1fr)_138px_136px_128px_48px] border-b border-border pb-3 text-base font-bold md:grid"
            >
              <span className="col-span-2">{t('purchase.cart.col.nfts')}</span>
              <span>{t('purchase.cart.col.price')}</span>
              <span>{t('purchase.cart.col.editions')}</span>
              <span>{t('purchase.cart.col.total')}</span>
            </div>
            <QuoteIssuesNotice issues={issues} names={names} onDismiss={dismiss} />
            <ul aria-label={t('purchase.cart.lines')} className="flex flex-col gap-6 md:gap-3">
              {lines.map((line) => (
                <CartLineRow
                  key={line.id}
                  line={line}
                  onRemove={removeLine}
                  removing={removingId === line.id}
                  say={say}
                />
              ))}
            </ul>
          </div>

          <MobileActionBar className="max-md:rounded-t-[2rem] max-md:bg-card">
            <aside
              aria-labelledby="cart-summary-title"
              className="flex flex-col gap-4 px-6 pt-6 pb-6 md:gap-5 md:p-0"
            >
              <h2
                id="cart-summary-title"
                className="sr-only md:not-sr-only md:border-b md:border-border md:pb-3 md:text-lg md:font-bold"
              >
                {t('purchase.summary.title')}
              </h2>
              <CouponForm couponCode={cart.data.couponCode} say={say} inputId={COUPON_INPUT_ID} />
              <div aria-live="polite" aria-busy={repricing} className="flex flex-col gap-2">
                {quote.isError && !quote.data ? (
                  <ErrorState error={quote.error} onRetry={() => void quote.refetch()} />
                ) : (
                  <QuoteTotals quote={quote.data} size="large" />
                )}
                <div className="min-h-4 self-end">
                  <RefreshingHint active={repricing && Boolean(quote.data)} />
                </div>
              </div>
              <Link
                to="/pagamento"
                className="grid h-[60px] place-items-center rounded-full bg-gradient-to-r from-primary to-[#b97c48] text-base font-bold text-primary-foreground transition-colors hover:from-primary-hover focus-visible:outline-2 md:h-10 md:rounded-none md:bg-primary md:bg-none md:text-[15px]"
              >
                {t('purchase.cart.checkout')}
              </Link>
              <Link
                to="/"
                hash="mercado"
                className="hidden text-center text-[15px] text-highlight hover:text-primary-hover md:block"
              >
                {t('purchase.cart.continue')}
              </Link>
            </aside>
          </MobileActionBar>
        </div>
      )}

      <div className="mt-12 hidden md:block">
        <SectionBoundary quiet>
          <Recommendations exclude={new Set(lines.map((l) => l.nftId))} />
        </SectionBoundary>
      </div>
    </section>
  )
}

function CartSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_332px] md:gap-[86px]">
      <LoadingRegion className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[100px] rounded-2xl md:h-[70px] md:rounded-none" />
        ))}
      </LoadingRegion>
      <QuoteTotalsSkeleton />
    </div>
  )
}
