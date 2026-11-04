// "Seus NFTs" column of the Pagamento frame: the quoted lines (quantities and totals from the
// Quote, names and images from the Cart) and the Quote's totals.
import { Link } from '@tanstack/react-router'
import type { Cart, Quote } from '@/contracts/purchase'
import { COUPON_INPUT_ID } from '@/features/cart/coupon-form'
import { QuoteTotals } from '@/features/cart/quote-totals'
import { useT } from '@/lib/i18n'
import { EthAmount } from '@/ui/eth'
import { cn } from '@/ui/lib/utils'
import { NftImage } from '@/ui/nft-image'

export function QuotedLines({ quote, cart, className }: { quote: Quote; cart: Cart; className?: string }) {
  const t = useT()
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {quote.lines.map((quoted) => {
        const line = cart.lines.find((l) => l.id === quoted.lineId)
        if (!line) return null
        return (
          <li
            key={quoted.lineId}
            className="grid grid-cols-[62px_minmax(0,1fr)_auto] items-center gap-x-3 bg-card p-1 pr-4"
            data-testid="quoted-line"
          >
            <NftImage image={line.nft.image} alt="" sizes="62px" className="size-[62px] rounded-md" />
            <div className="min-w-0">
              <p className="truncate font-bold">{line.nft.name}</p>
              <p className="truncate text-[13px] text-subtle-foreground">
                {t('purchase.cart.tokenId', { tokenId: line.nft.tokenId })}
              </p>
            </div>
            <p className="flex items-center gap-3 whitespace-nowrap">
              <span className="text-sm text-muted-foreground">
                {t('purchase.order.quantity', { quantity: quoted.quantity })}
              </span>
              <span className="text-lg font-bold text-highlight">
                <EthAmount value={quoted.lineTotal} />
              </span>
            </p>
          </li>
        )
      })}
    </ul>
  )
}

export function CheckoutSummary({ quote, cart }: { quote: Quote | undefined; cart: Cart }) {
  const t = useT()
  return (
    <section aria-labelledby="checkout-summary-title" className="flex flex-col gap-4">
      <h2 id="checkout-summary-title" className="text-[17px] font-bold">
        {t('purchase.checkout.yourNfts')}
      </h2>
      <div
        aria-hidden
        className="flex justify-between border-b border-border pb-2 text-[15px] font-bold md:text-base"
      >
        <span>{t('purchase.order.col.nfts')}</span>
        <span>{t('purchase.order.col.subtotal')}</span>
      </div>
      {quote && <QuotedLines quote={quote} cart={cart} />}
      <Link
        to="/carrinho"
        hash={COUPON_INPUT_ID}
        className="self-center text-sm hover:text-primary-hover hover:underline"
      >
        {t('purchase.checkout.promoLink')}
      </Link>
      <QuoteTotals quote={quote} className="border-b border-border pb-4" />
    </section>
  )
}
