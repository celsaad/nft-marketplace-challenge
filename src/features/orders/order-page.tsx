// Confirmação de pedido (desktop Figma frame; the same card stacks on mobile). The page reads the
// Order over REST (direct access and refresh work), follows it live through `order.updated` and
// polls while pending. The Receipt is the Order's frozen snapshot, never recomputed from the catalog.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ExternalLinkIcon, Loader2Icon, XCircleIcon, XIcon } from 'lucide-react'
import { useEffect } from 'react'
import { isApiError } from '@/app/api/errors'
import { keys } from '@/app/query/keys'
import { useSessionStore } from '@/app/session/store'
import type { Order, Receipt } from '@/contracts/purchase'
import { clearAttemptForOrder } from '@/features/checkout/attempt/storage'
import { clearDraft } from '@/features/checkout/draft'
import { shortAddress, walletsQuery } from '@/features/checkout/wallets'
import { useLocale, useT } from '@/lib/i18n'
import { formatEth, isZero } from '@/lib/money/eth'
import { EthAmount } from '@/ui/eth'
import { ErrorState, LoadingRegion, Skeleton } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'
import { NftImage } from '@/ui/nft-image'
import { Button } from '@/ui/primitives/button'
import { orderQuery } from './queries'

export function OrderPage({ orderId }: { orderId: string }) {
  const collectorId = useSessionStore((s) => s.collectorId)
  return collectorId ? <OrderView collectorId={collectorId} orderId={orderId} /> : null
}

function OrderView({ collectorId, orderId }: { collectorId: string; orderId: string }) {
  const t = useT()
  const queryClient = useQueryClient()
  const order = useQuery(orderQuery(collectorId, orderId))
  const status = order.data?.status

  // Once decided, the attempt is over: a confirmed Order also ends the draft, and the Cart changed
  // server-side either way (purchased quantities removed, or reserved Availability released).
  useEffect(() => {
    if (status !== 'confirmed' && status !== 'rejected') return
    if (status === 'confirmed') {
      clearAttemptForOrder(orderId)
      clearDraft()
    }
    void queryClient.invalidateQueries({ queryKey: keys.cart(collectorId) })
    void queryClient.invalidateQueries({ queryKey: keys.quoteAll(collectorId) })
  }, [status, orderId, collectorId, queryClient])

  if (order.isPending) return <OrderSkeleton />
  if (order.isError) {
    const kind = isApiError(order.error) ? order.error.kind : null
    return (
      <section className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
        <h1 className="sr-only">{t('purchase.order.notFound')}</h1>
        <ErrorState
          error={order.error}
          title={kind === 'forbidden' ? t('purchase.order.forbidden') : undefined}
          onRetry={kind === 'forbidden' || kind === 'notFound' ? undefined : () => void order.refetch()}
        />
        <Link to="/" className="self-center font-bold text-primary hover:text-primary-hover">
          {t('purchase.order.backHome')}
        </Link>
      </section>
    )
  }
  return <OrderCard order={order.data} collectorId={collectorId} />
}

function OrderCard({ order, collectorId }: { order: Order; collectorId: string }) {
  const t = useT()
  const navigate = useNavigate()
  const locale = useLocale((s) => s.locale)
  const wallets = useQuery(walletsQuery(collectorId))
  const { receipt } = order
  const wallet = wallets.data?.find((w) => w.address === receipt.walletAddress)
  const network = t(`purchase.network.${receipt.paymentNetwork}`)
  const date = new Date(order.updatedAt).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const tryAgain = () => {
    // The rejected attempt is over; /pagamento starts a new one with a new Idempotency Key.
    clearAttemptForOrder(order.id)
    void navigate({ to: '/pagamento' })
  }

  return (
    <section className="flex justify-center px-4 pt-8 pb-28 md:pt-20 md:pb-24">
      <article
        aria-labelledby="order-title"
        className="relative w-full max-w-[578px] border-b-[10px] border-primary bg-card"
        data-testid="order-card"
        data-status={order.status}
      >
        <Link
          to="/"
          aria-label={t('purchase.order.close')}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-primary hover:bg-surface-raised"
        >
          <XIcon aria-hidden className="size-5" />
        </Link>

        <header className="flex flex-col items-center gap-4 px-10 pt-6 pb-5 text-center">
          {order.status === 'confirmed' && <ThankYouIcon />}
          {order.status === 'pending' && (
            <Loader2Icon
              aria-hidden
              className="size-14 animate-spin text-primary motion-reduce:animate-none"
            />
          )}
          {order.status === 'rejected' && <XCircleIcon aria-hidden className="size-14 text-destructive" />}
          {/* Announces the status change as it happens (realtime or polling). */}
          <output aria-live="polite" className="block">
            <h1
              id="order-title"
              className="text-base font-bold text-muted-foreground"
              data-testid="order-status"
            >
              {order.status === 'confirmed' && t('purchase.order.confirmedTitle')}
              {order.status === 'pending' && t('purchase.order.pendingTitle')}
              {order.status === 'rejected' && t('purchase.order.rejectedTitle')}
            </h1>
          </output>
          {order.status === 'pending' && (
            <p className="text-sm text-muted-foreground">{t('purchase.order.pendingBody')}</p>
          )}
          {order.status === 'rejected' && (
            <div className="flex flex-col gap-1 text-sm">
              <p>{t(`purchase.order.rejected.${order.rejectionReason ?? 'payment-declined'}`)}</p>
              <p className="text-muted-foreground">{t('purchase.order.itemsKept')}</p>
            </div>
          )}
        </header>

        <dl className="grid grid-cols-2 gap-y-3 border-y border-primary px-6 py-3 text-sm md:grid-cols-4 md:px-9">
          <Fact
            label={order.transactionHash ? t('purchase.order.transactionId') : t('purchase.order.orderId')}
            value={
              order.transactionHash
                ? shortAddress(order.transactionHash).toUpperCase().replace(/^0X/, '0x')
                : order.id
            }
            strong
          />
          <Fact label={t('purchase.order.date')} value={date} />
          <Fact label={t('purchase.order.total')} value={formatEth(receipt.total)} />
          <Fact
            label={t('purchase.order.wallet')}
            value={wallet ? t(`purchase.provider.${wallet.provider}`) : shortAddress(receipt.walletAddress)}
            strong
            last
          />
        </dl>

        <div className="flex flex-col gap-4 px-6 pt-6 pb-10 md:px-11">
          <h2 className="text-[15px] font-bold">{t('purchase.order.details')}</h2>
          <ReceiptLines receipt={receipt} />
          <ReceiptTotals receipt={receipt} />

          {order.status === 'confirmed' && (
            <>
              <p className="text-center text-sm text-muted-foreground">
                {t('purchase.order.confirmedOn', { network })}
              </p>
              {order.explorerUrl && (
                <div className="flex flex-col items-center gap-2">
                  <Button asChild className="h-12 px-4 text-[15px] font-bold">
                    <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer">
                      {t('purchase.order.explorer')}
                      <ExternalLinkIcon aria-hidden />
                    </a>
                  </Button>
                  <p className="text-xs text-subtle-foreground">{t('purchase.order.simulated')}</p>
                </div>
              )}
            </>
          )}
          {order.status === 'rejected' && (
            <div className="flex flex-wrap justify-center gap-3">
              <Button type="button" className="h-12 px-6 font-bold" onClick={tryAgain}>
                {t('purchase.order.tryAgain')}
              </Button>
              <Button asChild variant="outline" className="h-12 px-6">
                <Link to="/carrinho">{t('purchase.order.viewCart')}</Link>
              </Button>
            </div>
          )}
        </div>
      </article>
    </section>
  )
}

function Fact({
  label,
  value,
  strong,
  last,
}: {
  label: string
  value: string
  strong?: boolean
  last?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-col px-3 md:border-r md:border-primary', last && 'md:border-r-0')}>
      <dt className={cn('text-muted-foreground', strong && 'font-bold')}>{label}</dt>
      <dd className="break-words text-muted-foreground tabular-nums">{value}</dd>
    </div>
  )
}

function ReceiptLines({ receipt }: { receipt: Receipt }) {
  const t = useT()
  return (
    <table className="w-full table-fixed border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-[15px]">
          <th scope="col" className="pb-2 font-bold">
            {t('purchase.order.col.nfts')}
          </th>
          <th scope="col" className="w-16 pb-2 text-center font-bold md:w-24">
            {t('purchase.order.col.editions')}
          </th>
          <th scope="col" className="w-24 pb-2 text-right font-bold md:w-28">
            {t('purchase.order.col.subtotal')}
          </th>
        </tr>
      </thead>
      <tbody>
        {receipt.lines.map((line) => (
          <tr key={line.editionId} data-testid="receipt-line">
            <td className="py-2">
              <div className="flex items-center gap-3">
                <NftImage
                  image={line.image}
                  alt=""
                  sizes="70px"
                  className="size-10 shrink-0 rounded-md sm:size-[70px]"
                />
                <div className="min-w-0">
                  <p className="font-bold break-words">{line.name}</p>
                  <p className="text-[13px] break-words text-subtle-foreground">
                    {t('purchase.cart.tokenId', { tokenId: line.tokenId })}
                  </p>
                </div>
              </div>
            </td>
            <td className="text-center text-sm text-muted-foreground">
              {t('purchase.order.quantity', { quantity: line.quantity })}
            </td>
            <td className="text-right font-bold text-primary">
              <EthAmount value={line.lineTotal} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReceiptTotals({ receipt }: { receipt: Receipt }) {
  const t = useT()
  const row = 'grid grid-cols-[minmax(0,1fr)_auto] gap-4 md:grid-cols-[1fr_auto] md:pl-[36%]'
  return (
    <dl className="flex flex-col gap-2 border-b border-border pb-3 text-[15px]" data-testid="receipt-totals">
      {!isZero(receipt.discount) && (
        <>
          <div className={row}>
            <dt>{t('purchase.summary.subtotal')}</dt>
            <dd>
              <EthAmount value={receipt.subtotal} />
            </dd>
          </div>
          <div className={row}>
            <dt>{t('purchase.summary.discountCode', { code: receipt.couponCode ?? '' })}</dt>
            <dd className="tabular-nums">(-) {formatEth(receipt.discount)}</dd>
          </div>
        </>
      )}
      <div className={row}>
        <dt>{t('purchase.summary.networkFee')}</dt>
        <dd>
          <EthAmount value={receipt.networkFee} />
        </dd>
      </div>
      <div className={cn(row, 'font-bold')}>
        <dt>{t('purchase.summary.total')}</dt>
        <dd className="text-primary" data-testid="receipt-total">
          <EthAmount value={receipt.total} />
        </dd>
      </div>
    </dl>
  )
}

/** The envelope from the Figma confirmation frame (decorative: the heading says it in words). */
function ThankYouIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 72 80"
      className="h-20 w-[68px] text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    >
      <path d="M10 29 4 34v42h64V34l-6-5" />
      <path d="M10 44V4h52v40" />
      <path d="M4 76 30 50h12l26 26M4 34l24 18M68 34 44 52" />
      <text
        x="36"
        y="20"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="10"
        fontWeight="700"
        fontFamily="inherit"
      >
        THANK
      </text>
      <text
        x="36"
        y="32"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="10"
        fontWeight="700"
        fontFamily="inherit"
      >
        YOU
      </text>
    </svg>
  )
}

function OrderSkeleton() {
  return (
    <section className="flex justify-center px-4 pt-8 pb-28 md:pt-20">
      <LoadingRegion className="flex w-full max-w-[578px] flex-col gap-4 bg-card p-8">
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto h-5 w-64" />
        <Skeleton className="h-12" />
        <Skeleton className="h-[70px]" />
        <Skeleton className="h-[70px]" />
        <Skeleton className="h-16" />
      </LoadingRegion>
    </section>
  )
}
