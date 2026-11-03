// Edition choice, quantity and "Comprar". Everything reads the live NFT from the query cache, so a
// realtime Price or Availability change re-renders the limits at once; the server still has the
// last word (AVAILABILITY_CONFLICT / QUANTITY_LIMIT are shown inline).
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { MinusIcon, PlusIcon, ShoppingCartIcon } from 'lucide-react'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { useState } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/app/api/errors'
import { keys } from '@/app/query/keys'
import type { NftDetail } from '@/contracts/catalog'
import { useAddToCart } from '@/features/cart/mutations'
import { FavoriteButton } from '@/features/favorites/favorite-button'
import { useT } from '@/lib/i18n'
import { EthAmount } from '@/ui/eth'
import { errorMessageKey } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'
import { Button } from '@/ui/primitives/button'
import {
  clampQuantity,
  defaultEdition,
  editionLabel,
  isAvailable,
  limitReason,
  maxQuantity,
} from './editions'

export function usePurchase(nft: NftDetail) {
  const t = useT()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  const [editionId, setEditionId] = useState(() => defaultEdition(nft.editions)?.id)
  const [wanted, setWanted] = useState(1)

  const edition = nft.editions.find((e) => e.id === editionId) ?? defaultEdition(nft.editions)
  const max = maxQuantity(edition, nft.maxPerOrder)
  const quantity = clampQuantity(wanted, max)
  const label = (e = edition) => (e ? editionLabel(e, t('catalog.nft.editionOpen')) : '')

  const selectEdition = (id: string) => {
    addToCart.reset()
    setEditionId(id)
  }
  const setQuantity = (next: number) => {
    addToCart.reset()
    setWanted(clampQuantity(next, max))
  }

  const buy = () => {
    if (!edition || max === 0 || addToCart.isPending) return
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          toast.success(t('catalog.nft.added', { quantity, name: nft.name, edition: label() }), {
            action: { label: t('catalog.nft.viewCart'), onClick: () => void navigate({ to: '/carrinho' }) },
          })
        },
        onError: (error) => {
          // Our numbers were stale: fetch the real Availability so the limits are right again.
          if (isApiError(error) && error.code === 'AVAILABILITY_CONFLICT') {
            void queryClient.invalidateQueries({ queryKey: keys.nft(nft.id) })
          }
        },
      },
    )
  }

  const error = addToCart.error
  const errorText = !error
    ? null
    : isApiError(error) && error.code === 'AVAILABILITY_CONFLICT'
      ? t('catalog.nft.conflict')
      : isApiError(error) && error.code === 'QUANTITY_LIMIT'
        ? t('catalog.nft.quantityLimit', { max: nft.maxPerOrder })
        : `${t('catalog.nft.addFailed')} ${t(errorMessageKey(error))}`

  return {
    edition,
    label,
    selectEdition,
    quantity,
    setQuantity,
    max,
    reason: limitReason(quantity, edition, nft.maxPerOrder),
    buy,
    pending: addToCart.isPending,
    errorText,
  }
}

export type Purchase = ReturnType<typeof usePurchase>

export function EditionPicker({ nft, purchase }: { nft: NftDetail; purchase: Purchase }) {
  const t = useT()
  const soldOutLabels = nft.editions.filter((e) => !isAvailable(e)).map((e) => purchase.label(e))
  return (
    <div className="flex flex-col gap-2">
      <p id="edition-label" className="text-sm font-bold md:text-[0.8125rem]">
        {t('catalog.nft.edition')}
      </p>
      <RadioGroupPrimitive.Root
        aria-labelledby="edition-label"
        aria-describedby={soldOutLabels.length ? 'edition-sold-out' : undefined}
        value={purchase.edition?.id}
        onValueChange={purchase.selectEdition}
        orientation="horizontal"
        className="flex flex-wrap gap-2"
      >
        {nft.editions.map((edition) => (
          <RadioGroupPrimitive.Item
            key={edition.id}
            value={edition.id}
            disabled={!isAvailable(edition)}
            className={cn(
              'min-h-8 rounded-full border border-border px-2.5 text-xs text-foreground tabular-nums transition-colors hover:border-primary',
              'data-[state=checked]:border-primary data-[state=checked]:font-bold data-[state=checked]:text-primary',
              'disabled:cursor-not-allowed disabled:text-subtle-foreground disabled:line-through disabled:opacity-60 disabled:hover:border-border',
              'md:min-h-7 md:px-2',
            )}
          >
            {purchase.label(edition)}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
      {soldOutLabels.length > 0 && (
        <p id="edition-sold-out" className="text-xs text-subtle-foreground">
          {soldOutLabels.map((edition) => t('catalog.nft.editionSoldOut', { edition })).join(' · ')}
        </p>
      )}
    </div>
  )
}

function Stepper({ purchase, disabled }: { purchase: Purchase; disabled: boolean }) {
  const t = useT()
  const { quantity, max, setQuantity } = purchase
  const step =
    'grid size-8 place-items-center rounded-full bg-gradient-to-b from-primary-hover to-primary text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-7'
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t('catalog.nft.quantity')}</legend>
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-sm font-bold md:hidden">
          {t('catalog.nft.quantityShort')}
        </span>
        <button
          type="button"
          aria-label={t('catalog.nft.decrease')}
          disabled={disabled || quantity <= 1}
          onClick={() => setQuantity(quantity - 1)}
          className={step}
        >
          <MinusIcon aria-hidden className="size-4" />
        </button>
        <output aria-live="polite" className="w-6 text-center text-base tabular-nums" data-testid="quantity">
          {quantity}
        </output>
        <button
          type="button"
          aria-label={t('catalog.nft.increase')}
          disabled={disabled || quantity >= max}
          onClick={() => setQuantity(quantity + 1)}
          className={step}
        >
          <PlusIcon aria-hidden className="size-4" />
        </button>
      </div>
    </fieldset>
  )
}

/** Stepper, buy and favorite. Mobile: the Figma's bottom panel; desktop: one row under the chips. */
export function PurchasePanel({
  nft,
  purchase,
  className,
}: {
  nft: NftDetail
  purchase: Purchase
  className?: string
}) {
  const t = useT()
  const { edition, max, reason, errorText } = purchase
  const editionGone = Boolean(edition && !isAvailable(edition))
  const blocked = nft.soldOut || editionGone || max === 0

  const hint = nft.soldOut
    ? t('catalog.nft.soldOut')
    : editionGone
      ? t('catalog.nft.editionUnavailable')
      : reason === 'available'
        ? t('catalog.nft.limitAvailable', { max })
        : reason === 'order'
          ? t('catalog.nft.limitOrder', { max })
          : edition?.size === null
            ? t('catalog.nft.editionOpenNote')
            : edition?.available === 1
              ? t('catalog.nft.editionAvailableOne')
              : t('catalog.nft.editionAvailable', { count: edition?.available ?? 0 })

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-t-[2rem] bg-card px-4 pt-5 pb-5 max-md:-mx-4 md:rounded-none md:bg-transparent md:p-0',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Stepper purchase={purchase} disabled={blocked} />
        <EthAmount value={nft.price} className="text-2xl font-bold text-primary md:hidden" />
        <div className="hidden items-center gap-2 md:flex">
          <Button
            type="button"
            onClick={purchase.buy}
            disabled={blocked || purchase.pending}
            aria-describedby="purchase-hint"
            className="h-10 min-w-36 rounded-sm text-xs font-bold uppercase hover:bg-primary-hover"
          >
            {purchase.pending && (
              <span
                aria-hidden
                className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
              />
            )}
            {t('catalog.nft.buy')}
          </Button>
          <FavoriteButton
            nftId={nft.id}
            nftName={nft.name}
            variant="labeled"
            className="rounded-sm text-xs"
          />
        </div>
      </div>

      <p
        id="purchase-hint"
        aria-live="polite"
        className={cn('text-xs', blocked ? 'font-bold text-destructive' : 'text-subtle-foreground')}
      >
        {hint}
      </p>
      {errorText && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {errorText}
        </p>
      )}

      <div className="flex items-center gap-4 md:hidden">
        <Button
          type="button"
          onClick={purchase.buy}
          disabled={blocked || purchase.pending}
          aria-describedby="purchase-hint"
          className="h-14 flex-1 rounded-full bg-gradient-to-r from-primary-hover to-primary text-base font-bold"
        >
          {t('catalog.nft.buyMobile')}
        </Button>
        <Button
          asChild
          variant="ghost"
          className="size-14 rounded-full border border-border bg-surface-raised text-primary"
        >
          <Link to="/carrinho" aria-label={t('catalog.nft.viewCart')}>
            <ShoppingCartIcon aria-hidden className="size-5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
