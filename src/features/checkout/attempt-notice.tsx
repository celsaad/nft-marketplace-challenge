// What the Checkout Attempt needs from the Collector, by state: accept a changed Quote, retry a
// request whose answer was lost (same key), or start over after a failure the server decided.
import { Loader2Icon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'
import type { ApiError } from '@/app/api/errors'
import { IssueList } from '@/features/cart/quote-issues'
import { type MessageKey, useT } from '@/lib/i18n'
import { formatEth } from '@/lib/money/eth'
import { errorMessageKey } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'
import { Button } from '@/ui/primitives/button'
import type { CheckoutAttempt } from './attempt/use-checkout-attempt'

export function failureMessageKey(error: ApiError | null): MessageKey {
  if (!error) return 'purchase.review.error.generic'
  if (error.code === 'WALLET_NOT_CONNECTED') return 'purchase.review.error.walletNotConnected'
  if (error.code === 'WALLET_NETWORK_MISMATCH') return 'purchase.review.error.walletMismatch'
  if (error.fieldErrors.cart) return 'purchase.review.error.emptyCart'
  const key = errorMessageKey(error)
  return key === 'error.unknown' ? 'purchase.review.error.generic' : key
}

const box = 'flex flex-col gap-3 rounded-lg border p-4 text-sm'

export function AttemptNotice({
  attempt,
  names,
  className,
}: {
  attempt: CheckoutAttempt
  names: ReadonlyMap<string, string>
  className?: string
}) {
  const t = useT()
  let content: React.ReactNode = null

  if (attempt.state === 'quoteChanged') {
    const next = attempt.nextQuote
    content = (
      <div className={cn(box, 'border-primary/70 bg-band')} data-testid="quote-changed">
        <p className="flex items-center gap-2 font-bold">
          <TriangleAlertIcon aria-hidden className="size-4 text-primary" />
          {t('purchase.review.quoteChanged')}
        </p>
        {next ? (
          <>
            <p>{t('purchase.review.quoteChangedBody')}</p>
            {next.issues.length > 0 && <IssueList issues={next.issues} names={names} />}
            {attempt.quote && (
              <p className="font-bold">
                {t('purchase.review.totalChange', {
                  from: formatEth(attempt.quote.total),
                  to: formatEth(next.total),
                })}
              </p>
            )}
            <Button type="button" className="self-start" onClick={attempt.acceptNewQuote}>
              {t('purchase.review.accept')}
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-2">
            <Loader2Icon aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            {t('purchase.review.quoteLoading')}
          </p>
        )}
      </div>
    )
  } else if (attempt.state === 'recovering') {
    content = (
      <div className={cn(box, 'border-primary/70 bg-band')} data-testid="attempt-recovering">
        <p className="font-bold">{t('purchase.review.recovering')}</p>
        <p>{t('purchase.review.recoveringBody')}</p>
        <Button type="button" className="self-start" onClick={attempt.retry}>
          <RefreshCwIcon aria-hidden />
          {t('purchase.review.retry')}
        </Button>
      </div>
    )
  } else if (attempt.state === 'failed') {
    content = (
      <div className={cn(box, 'border-destructive/70')} data-testid="attempt-failed">
        <p className="font-bold">{t('purchase.review.failed')}</p>
        <p>{t(failureMessageKey(attempt.error))}</p>
        <Button type="button" variant="outline" className="self-start" onClick={attempt.startOver}>
          {t('purchase.review.startOver')}
        </Button>
      </div>
    )
  }

  // The region is always mounted so a change of state is announced, not just drawn.
  return (
    <output aria-live="polite" className={cn('block', !content && 'sr-only', className)}>
      {content}
    </output>
  )
}
