// One Cart Line, laid out as a table row on desktop and as a card on mobile (Figma frames).
import { Link } from '@tanstack/react-router'
import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import type { ApiError } from '@/app/api/errors'
import type { CartLine } from '@/contracts/purchase'
import { useT } from '@/lib/i18n'
import { times } from '@/lib/money/eth'
import { EthAmount } from '@/ui/eth'
import { errorMessageKey } from '@/ui/failure'
import { cn } from '@/ui/lib/utils'
import { NftImage } from '@/ui/nft-image'
import { editionLabel } from './line-names'
import { useLineQuantity } from './use-line-quantity'

export function CartLineRow({
  line,
  onRemove,
  removing,
  say,
}: {
  line: CartLine
  onRemove: (line: CartLine) => void
  removing: boolean
  say: (text: string) => void
}) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  const name = line.nft.name
  const { quantity, setQuantity } = useLineQuantity(line, {
    onSaved: (q) => {
      setError(null)
      say(t('purchase.cart.quantityUpdated', { name, quantity: q }))
    },
    onError: (e: ApiError) => {
      const reason =
        e.code === 'AVAILABILITY_CONFLICT' || e.code === 'QUANTITY_LIMIT'
          ? t('purchase.cart.maxReached', { max: line.maxQuantity })
          : t(errorMessageKey(e))
      const text = t('purchase.cart.quantityError', { name, reason })
      setError(text)
      say(text)
    },
  })
  const soldOut = line.maxQuantity === 0
  const atMax = quantity >= line.maxQuantity
  const messageId = `line-${line.id}-message`
  const message = soldOut
    ? t('purchase.cart.soldOut')
    : (error ?? (atMax ? t('purchase.cart.maxReached', { max: line.maxQuantity }) : null))

  return (
    <li
      className="relative grid grid-cols-[100px_minmax(0,1fr)] overflow-hidden rounded-2xl bg-card md:grid-cols-[70px_minmax(0,1fr)_138px_136px_128px_48px] md:items-center md:rounded-none"
      data-testid="cart-line"
      aria-label={name}
    >
      <Link to="/nft/$nftId" params={{ nftId: line.nftId }} tabIndex={-1} aria-hidden className="block">
        <NftImage
          image={line.nft.image}
          alt=""
          sizes="100px"
          className="size-[100px] rounded-none md:size-[70px]"
        />
      </Link>

      <div className="flex min-w-0 flex-col justify-center gap-1 py-3 pr-14 pl-4 md:py-0 md:pr-2">
        <Link
          to="/nft/$nftId"
          params={{ nftId: line.nftId }}
          className="truncate text-base font-bold hover:text-primary-hover"
        >
          {name}
        </Link>
        <p className="text-sm text-muted-foreground md:hidden">
          {t('purchase.cart.edition', {
            edition: editionLabel(line.edition.size, t('purchase.cart.openEdition')),
          })}
        </p>
        <p className="hidden text-[13px] text-subtle-foreground md:block">
          {t('purchase.cart.tokenId', { tokenId: line.nft.tokenId })}
          <span className="sr-only">, </span>
          <span className="block">
            {t('purchase.cart.edition', {
              edition: editionLabel(line.edition.size, t('purchase.cart.openEdition')),
            })}
          </span>
        </p>
        <p className="text-lg font-bold text-highlight md:hidden">
          <span className="sr-only">{t('purchase.cart.unitPrice')}: </span>
          <EthAmount value={line.unitPrice} />
        </p>
      </div>

      <p className="hidden text-base font-bold text-muted-foreground md:block">
        <span className="sr-only">{t('purchase.cart.unitPrice')}: </span>
        <EthAmount value={line.unitPrice} />
      </p>

      <div className="col-start-2 flex items-center gap-3 pb-3 pl-4 md:col-start-auto md:pb-0 md:pl-0">
        <QuantityStepper
          name={name}
          quantity={quantity}
          max={line.maxQuantity}
          onChange={setQuantity}
          disabled={soldOut || removing}
          describedBy={message ? messageId : undefined}
        />
      </div>

      <p className="hidden text-base font-bold text-highlight md:block" data-testid="line-total">
        <span className="sr-only">{t('purchase.cart.lineTotal')}: </span>
        {/* Between Quotes the line total follows the stepper at once (ADR 0006: display only). */}
        <EthAmount value={times(line.unitPrice, quantity)} />
      </p>

      <button
        type="button"
        onClick={() => onRemove(line)}
        disabled={removing}
        aria-label={t('purchase.cart.remove', { name })}
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary-hover disabled:opacity-50 md:static md:justify-self-center"
      >
        <Trash2Icon aria-hidden className="size-5" />
      </button>

      {message && (
        <p
          id={messageId}
          className={cn(
            'col-span-2 px-4 pb-3 text-xs md:col-span-6 md:px-3 md:pb-2',
            soldOut || error ? 'text-destructive' : 'text-subtle-foreground',
          )}
        >
          {message}
        </p>
      )}
    </li>
  )
}

function QuantityStepper({
  name,
  quantity,
  max,
  onChange,
  disabled,
  describedBy,
}: {
  name: string
  quantity: number
  max: number
  onChange: (next: number) => void
  disabled: boolean
  describedBy?: string
}) {
  const t = useT()
  const button =
    'grid size-8 place-items-center rounded-full bg-surface-raised text-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-40 md:h-6 md:w-[18px] md:rounded-md md:bg-primary md:text-primary-foreground'
  return (
    <fieldset className="flex items-center gap-3" aria-describedby={describedBy}>
      <legend className="sr-only">{t('purchase.cart.quantity', { name })}</legend>
      <button
        type="button"
        className={button}
        onClick={() => onChange(quantity - 1)}
        disabled={disabled || quantity <= 1}
        aria-label={t('purchase.cart.decrease', { name })}
      >
        <MinusIcon aria-hidden className="size-4 md:size-3" />
      </button>
      <span
        className="min-w-5 text-center text-lg tabular-nums md:text-[15px]"
        aria-live="polite"
        aria-atomic
      >
        <span className="sr-only">{t('purchase.cart.quantity', { name })}: </span>
        <span data-testid="line-quantity">{quantity}</span>
      </span>
      <button
        type="button"
        className={button}
        onClick={() => onChange(quantity + 1)}
        disabled={disabled || quantity >= max}
        aria-label={t('purchase.cart.increase', { name })}
      >
        <PlusIcon aria-hidden className="size-4 md:size-3" />
      </button>
    </fieldset>
  )
}
