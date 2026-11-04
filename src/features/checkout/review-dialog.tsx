// The review step before an Order exists: everything the Collector is about to pay for, the
// Wallet Connection, and the final confirmation. The dialog can't be dismissed while the Order
// request is in flight, and confirming is locked from the first click.
import { Loader2Icon, PlugIcon, XIcon } from 'lucide-react'
import type { Wallet } from '@/contracts/account'
import type { Cart, Quote } from '@/contracts/purchase'
import { QuoteTotals } from '@/features/cart/quote-totals'
import { shortAddress } from '@/lib/address'
import { useT } from '@/lib/i18n'
import { Button } from '@/ui/primitives/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/primitives/dialog'
import type { CheckoutAttempt } from './attempt/use-checkout-attempt'
import { AttemptNotice } from './attempt-notice'
import { QuotedLines } from './checkout-summary'
import type { ConnectionStatus } from './wallets'

export function ReviewDialog({
  open,
  onOpenChange,
  attempt,
  quote,
  cart,
  wallet,
  email,
  connection,
  onConnect,
  onConfirm,
  names,
  returnFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  attempt: CheckoutAttempt
  quote: Quote | undefined
  cart: Cart
  wallet: Wallet | null
  email: string
  connection: ConnectionStatus
  onConnect: () => void
  onConfirm: () => void
  names: ReadonlyMap<string, string>
  /** Where focus goes on close: the button that opened it, even if it re-rendered meanwhile. */
  returnFocus: () => HTMLElement | null
}) {
  const t = useT()
  const submitting = attempt.state === 'submitting'
  const connected = connection === 'approved'
  const canConfirm = attempt.state === 'reviewing' && connected && Boolean(attempt.quote)

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          const target = returnFocus()
          if (!target) return
          event.preventDefault()
          target.focus()
        }}
        className="max-h-[92dvh] gap-5 overflow-y-auto border-border bg-card sm:max-w-xl"
        data-testid="review-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-lg">{t('purchase.review.title')}</DialogTitle>
          <DialogDescription>{t('purchase.review.description')}</DialogDescription>
        </DialogHeader>
        <DialogClose
          disabled={submitting}
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-primary hover:bg-surface-raised disabled:opacity-50"
          aria-label={t('purchase.review.close')}
        >
          <XIcon aria-hidden className="size-4" />
        </DialogClose>

        <AttemptNotice attempt={attempt} names={names} />

        {quote && <QuotedLines quote={quote} cart={cart} />}
        <QuoteTotals quote={quote} />

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('purchase.review.wallet')}</dt>
          <dd className="truncate">
            {wallet
              ? `${t(`purchase.provider.${wallet.provider}`)} · ${wallet.label} · ${shortAddress(wallet.address)}`
              : '—'}
          </dd>
          <dt className="text-muted-foreground">{t('purchase.review.network')}</dt>
          <dd>{quote ? t(`purchase.network.${quote.paymentNetwork}`) : '—'}</dd>
          <dt className="text-muted-foreground">{t('purchase.review.buyer')}</dt>
          <dd className="truncate">{email}</dd>
        </dl>

        {!connected && wallet && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
            <p>{t('purchase.review.notConnected')}</p>
            {connection === 'rejected' && (
              <p className="text-destructive">{t('purchase.checkout.walletRejected')}</p>
            )}
            <Button
              type="button"
              variant="outline"
              className="self-start border-primary text-primary"
              onClick={onConnect}
              disabled={connection === 'connecting'}
            >
              {connection === 'connecting' ? (
                <Loader2Icon aria-hidden className="animate-spin motion-reduce:animate-none" />
              ) : (
                <PlugIcon aria-hidden />
              )}
              {connection === 'connecting'
                ? t('purchase.checkout.connecting')
                : t('purchase.checkout.connect')}
            </Button>
          </div>
        )}

        <DialogFooter className="gap-3">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            {t('purchase.review.cancel')}
          </Button>
          <Button
            type="button"
            className="h-11 font-bold"
            onClick={onConfirm}
            disabled={!canConfirm}
            aria-disabled={!canConfirm}
          >
            {submitting && <Loader2Icon aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {submitting ? t('purchase.review.submitting') : t('purchase.review.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
