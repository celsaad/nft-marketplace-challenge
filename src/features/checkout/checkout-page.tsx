// Pagamento (desktop and mobile Figma frames). The form is prefilled from the profile and the
// Primary Wallet, saved as a draft, validated with BuyerDetailsSchema, and reviewed in a dialog
// before the Checkout Attempt creates the Order.
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { ChevronLeftIcon, Loader2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSessionStore } from '@/app/session/store'
import type { Collector, Wallet } from '@/contracts/account'
import type { Network } from '@/contracts/common'
import { type BuyerDetails, BuyerDetailsSchema, type Cart } from '@/contracts/purchase'
import { meQuery } from '@/features/account/queries'
import { useLineNames } from '@/features/cart/line-names'
import { useLiveRegion } from '@/features/cart/live-region'
import { useCart, useQuote } from '@/features/cart/queries'
import { orderQuery } from '@/features/orders/queries'
import { useT } from '@/lib/i18n'
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/ui/feedback'
import { Button } from '@/ui/primitives/button'
import { readAttempt } from './attempt/storage'
import { useCheckoutAttempt } from './attempt/use-checkout-attempt'
import { AttemptNotice } from './attempt-notice'
import { BuyerFields } from './buyer-fields'
import { CheckoutSummary } from './checkout-summary'
import { readDraft, saveDraft } from './draft'
import { ReviewDialog } from './review-dialog'
import { WalletPicker } from './wallet-picker'
import { useWalletConnection, useWallets, walletFor } from './wallets'

export function CheckoutPage() {
  const collectorId = useSessionStore((s) => s.collectorId)
  // The /_auth layout only renders this with a Session.
  return collectorId ? <CheckoutGate collectorId={collectorId} /> : null
}

/** An attempt whose Order is still pending is recovered on its Order page, never re-submitted. */
function CheckoutGate({ collectorId }: { collectorId: string }) {
  const t = useT()
  const [savedAttempt] = useState(() => readAttempt(collectorId))
  const savedOrderId = savedAttempt?.orderId ?? null
  const saved = useQuery({ ...orderQuery(collectorId, savedOrderId ?? ''), enabled: Boolean(savedOrderId) })
  const cart = useCart()
  const me = useQuery(meQuery(collectorId))
  const wallets = useWallets(collectorId)
  // A request whose outcome is unknown is resumed even if its Order has since emptied the Cart.
  const [started, setStarted] = useState(() => Boolean(savedAttempt?.input && !savedAttempt.orderId))

  if (savedOrderId && saved.isPending) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm">
          <Loader2Icon aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          {t('purchase.checkout.loadingOrder')}
        </p>
      </Shell>
    )
  }
  if (savedOrderId && saved.data?.status === 'pending') {
    return <Navigate to="/pedidos/$orderId" params={{ orderId: savedOrderId }} replace />
  }

  const failed = [cart, me, wallets].find((q) => q.isError)
  if (failed) {
    return (
      <Shell>
        <ErrorState error={failed.error} onRetry={() => void failed.refetch()} />
      </Shell>
    )
  }
  if (!cart.data || !me.data || !wallets.data) {
    return (
      <Shell>
        <CheckoutSkeleton />
      </Shell>
    )
  }
  // Once checkout has started, the form stays: an Order created by a request whose answer was
  // lost may already have emptied the Cart, and the attempt still has to be recovered here.
  if (cart.data.lines.length > 0 && !started) setStarted(true)
  if (cart.data.lines.length === 0 && !started) {
    return (
      <Shell>
        <EmptyState title={t('purchase.checkout.emptyCart')}>
          <Link to="/" hash="mercado" className="font-bold text-primary hover:text-primary-hover">
            {t('purchase.cart.explore')}
          </Link>
        </EmptyState>
      </Shell>
    )
  }
  return <CheckoutForm collectorId={collectorId} cart={cart.data} me={me.data} wallets={wallets.data} />
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useT()
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pt-6 pb-28 md:gap-8 md:px-6 md:pt-8 md:pb-16">
      <div className="relative flex items-center justify-center md:sr-only">
        <Link
          to="/carrinho"
          aria-label={t('purchase.back')}
          className="absolute left-0 grid size-12 place-items-center rounded-full bg-surface-raised text-primary md:hidden"
        >
          <ChevronLeftIcon aria-hidden />
        </Link>
        <h1 className="text-xl font-bold">{t('purchase.checkout.title')}</h1>
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
            <Link to="/carrinho" className="hover:text-primary-hover">
              {t('purchase.breadcrumb.cart')}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{t('purchase.breadcrumb.checkout')}</li>
        </ol>
      </nav>
      {children}
    </section>
  )
}

function defaults(
  me: Collector,
  wallet: Wallet | null,
  saved: Partial<BuyerDetails> | undefined,
): BuyerDetails {
  return {
    displayName: me.displayName,
    username: me.username,
    profileName: me.displayName,
    email: me.email,
    ensName: me.ensName ?? '',
    referralCode: '',
    secondaryWallet: '',
    note: '',
    ...saved,
    // Always the chosen Wallet's address: it is what the Order is paid from.
    walletAddress: wallet?.address ?? '',
  }
}

function CheckoutForm({
  collectorId,
  cart,
  me,
  wallets,
}: {
  collectorId: string
  cart: Cart
  me: Collector
  wallets: Wallet[]
}) {
  const t = useT()
  const navigate = useNavigate()
  const { say, region } = useLiveRegion()
  const [draft] = useState(() => readDraft(collectorId))
  const [network, setNetwork] = useState<Network>(() => {
    const drafted = wallets.find((w) => w.id === draft?.walletId)
    return (drafted ?? wallets.find((w) => w.isPrimary) ?? wallets[0])?.network ?? 'ethereum'
  })
  const [walletId, setWalletId] = useState<string | null>(() => {
    const drafted = wallets.find((w) => w.id === draft?.walletId)
    return (drafted ?? walletFor(wallets, network))?.id ?? null
  })
  const wallet = wallets.find((w) => w.id === walletId) ?? null
  const [useOtherWallet, setUseOtherWallet] = useState(draft?.useOtherWallet ?? false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const connection = useWalletConnection(draft?.connectedWalletId ?? null)

  const form = useForm<BuyerDetails>({
    resolver: zodResolver(BuyerDetailsSchema),
    defaultValues: defaults(me, wallet, draft?.values),
    mode: 'onTouched',
  })

  const quote = useQuote(network, true)
  const attempt = useCheckoutAttempt({ collectorId, quote: quote.data, walletId })
  const names = useLineNames(cart)
  const shownQuote = attempt.nextQuote ?? attempt.quote ?? undefined

  // Keep the draft in step with every change, so a Session Expiry loses nothing.
  const connectedId = connection.connectedId
  useEffect(() => {
    const persist = () =>
      saveDraft({
        collectorId,
        values: form.getValues(),
        useOtherWallet,
        walletId,
        connectedWalletId: connectedId,
      })
    persist()
    return form.subscribe({ formState: { values: true }, callback: persist })
  }, [collectorId, form, useOtherWallet, walletId, connectedId])

  // An Order exists (pending or already decided): its page shows the outcome and recovers it.
  const { orderId, state } = attempt
  useEffect(() => {
    if (orderId && (state === 'pending' || state === 'confirmed' || state === 'rejected')) {
      void navigate({ to: '/pedidos/$orderId', params: { orderId } })
    }
  }, [orderId, state, navigate])

  const chooseWallet = (next: Wallet) => {
    setWalletId(next.id)
    setNetwork(next.network)
    setWalletError(null)
    form.setValue('walletAddress', next.address, { shouldValidate: true })
  }
  const chooseNetwork = (next: Network) => {
    setNetwork(next)
    const best = walletFor(wallets, next)
    setWalletId(best?.id ?? null)
    form.setValue('walletAddress', best?.address ?? '', { shouldValidate: form.formState.isSubmitted })
  }

  const openReview = form.handleSubmit(
    () => {
      if (!wallet) {
        setWalletError('purchase.checkout.walletRequired')
        say(t('purchase.checkout.walletRequired'))
        return
      }
      setReviewOpen(true)
    },
    () => say(t('purchase.checkout.formErrors')),
  )

  const confirm = form.handleSubmit((values) =>
    attempt.confirm({
      ...values,
      secondaryWallet: useOtherWallet && values.secondaryWallet ? values.secondaryWallet : undefined,
      note: values.note || undefined,
    }),
  )

  const submitting = attempt.state === 'submitting'

  return (
    <Shell>
      {region}
      {draft && (
        <p className="text-sm text-muted-foreground" data-testid="draft-restored">
          {t('purchase.checkout.draftRestored')}
        </p>
      )}
      <form
        noValidate
        onSubmit={(e) => void openReview(e)}
        className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:gap-x-8 lg:grid-cols-[minmax(0,763px)_405px]"
      >
        <div className="md:col-start-2 md:row-start-2">
          <WalletSection
            wallets={wallets}
            walletId={walletId}
            onSelect={chooseWallet}
            connection={connection}
            walletError={walletError}
          />
        </div>
        <div className="md:col-start-1 md:row-span-3 md:row-start-1">
          <BuyerFields
            form={form}
            wallets={wallets}
            network={network}
            onNetworkChange={chooseNetwork}
            walletId={walletId}
            onWalletChange={chooseWallet}
            walletError={walletError}
            useOtherWallet={useOtherWallet}
            onUseOtherWalletChange={setUseOtherWallet}
          />
        </div>
        <div className="md:col-start-2 md:row-start-1">
          {quote.isError && !shownQuote ? (
            <ErrorState error={quote.error} onRetry={() => void quote.refetch()} />
          ) : (
            <CheckoutSummary quote={shownQuote} cart={cart} />
          )}
        </div>
        <div className="flex flex-col gap-4 md:col-start-2 md:row-start-3">
          {!reviewOpen && <AttemptNotice attempt={attempt} names={names} />}
          <Button
            type="submit"
            disabled={submitting}
            className="h-16 rounded-full bg-gradient-to-r from-primary to-[#b97c48] text-lg font-bold text-primary-foreground hover:from-primary-hover md:h-11 md:rounded-md md:bg-primary md:bg-none md:text-sm"
          >
            {t('purchase.checkout.confirm')}
          </Button>
        </div>
      </form>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        attempt={attempt}
        quote={shownQuote}
        cart={cart}
        wallet={wallet}
        email={form.getValues('email')}
        connection={connection.statusOf(walletId)}
        onConnect={() => walletId && connection.connect(walletId)}
        onConfirm={() => void confirm()}
        names={names}
      />
    </Shell>
  )
}

function WalletSection({
  wallets,
  walletId,
  onSelect,
  connection,
  walletError,
}: {
  wallets: Wallet[]
  walletId: string | null
  onSelect: (wallet: Wallet) => void
  connection: ReturnType<typeof useWalletConnection>
  walletError: string | null
}) {
  return (
    <WalletPicker
      wallets={wallets}
      walletId={walletId}
      onSelect={onSelect}
      status={connection.statusOf(walletId)}
      onConnect={() => walletId && connection.connect(walletId)}
      onDisconnect={() => walletId && connection.disconnect(walletId)}
      disconnecting={connection.disconnecting}
      error={walletError}
    />
  )
}

function CheckoutSkeleton() {
  return (
    <LoadingRegion className="grid gap-8 md:grid-cols-[minmax(0,1fr)_405px]">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          // oxlint-disable-next-line react/no-array-index-key -- static placeholders
          <Skeleton key={i} className="h-[66px] rounded-none" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[70px] rounded-none" />
        <Skeleton className="h-[70px] rounded-none" />
        <Skeleton className="h-40 rounded-none" />
      </div>
    </LoadingRegion>
  )
}
