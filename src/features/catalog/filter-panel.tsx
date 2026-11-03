// The filter form from the Figma sidebar: Categories ("Coleções") and Networks with the API's
// faceted counts, and the price range. Controlled: the desktop sidebar applies each change to the
// URL at once, the mobile Sheet keeps a draft until "Aplicar".
import { CheckIcon } from 'lucide-react'
import { Slider as SliderPrimitive } from 'radix-ui'
import { useState } from 'react'
import { CATEGORIES, type CatalogPage, type Category } from '@/contracts/catalog'
import { NETWORKS, type Network } from '@/contracts/common'
import { useT } from '@/lib/i18n'
import type { Eth } from '@/lib/money/eth'
import { formatEth } from '@/lib/money/eth'
import { Skeleton } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'
import { Button } from '@/ui/primitives/button'
import { fromSteps, toSteps } from './price-range'

export interface FilterValue {
  category?: Category[]
  network?: Network[]
  minPrice?: Eth
  maxPrice?: Eth
}

type Facets = CatalogPage['facets']

function OptionList<K extends string>({
  legend,
  options,
  selected,
  counts,
  label,
  onToggle,
}: {
  legend: string
  options: readonly K[]
  selected: readonly K[] | undefined
  counts: Record<K, number> | undefined
  label: (key: K) => string
  onToggle: (key: K) => void
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <ul className="flex flex-col">
        {options.map((key) => {
          const on = selected?.includes(key) ?? false
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(key)}
                className={cn(
                  'flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-[0.8125rem] text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground md:min-h-9',
                  on && 'bg-primary/15 font-bold text-primary hover:text-primary',
                )}
              >
                <CheckIcon aria-hidden className={cn('size-3.5 shrink-0', !on && 'invisible')} />
                <span className="flex-1">{label(key)}</span>
                {counts ? (
                  <span className="tabular-nums">({counts[key] ?? 0})</span>
                ) : (
                  <Skeleton className="h-3 w-6" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

/** Slider over the catalog's price range; reports positions as ETH strings. */
function PriceRange({
  range,
  value,
  onChange,
  onApply,
}: {
  range: Facets['priceRange'] | undefined
  value: [Eth | undefined, Eth | undefined]
  onChange?: (min: Eth | undefined, max: Eth | undefined) => void
  /** Desktop: the slider is local state until this "Aplicar" is pressed. */
  onApply?: (min: Eth | undefined, max: Eth | undefined) => void
}) {
  const t = useT()
  const lo = range ? toSteps(range.min) : 0
  const hi = range ? Math.max(toSteps(range.max, { up: true }), lo + 1) : 100
  const clamp = (n: number) => Math.min(hi, Math.max(lo, n))
  const [draft, setDraft] = useState<[number, number]>(() => [
    clamp(value[0] ? toSteps(value[0]) : lo),
    clamp(value[1] ? toSteps(value[1], { up: true }) : hi),
  ])
  // The full range means "no price filter", so it never ends up in the URL.
  const toEth = ([a, b]: [number, number]): [Eth | undefined, Eth | undefined] => [
    a <= lo ? undefined : fromSteps(a),
    b >= hi ? undefined : fromSteps(b),
  ]

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-medium">{t('catalog.filters.price')}</legend>
      {range ? (
        // Radix directly (not the shadcn wrapper) so each thumb gets its own accessible name.
        <SliderPrimitive.Root
          min={lo}
          max={hi}
          step={1}
          minStepsBetweenThumbs={1}
          value={draft}
          onValueChange={(next) => {
            const pair: [number, number] = [next[0] ?? lo, next[1] ?? hi]
            setDraft(pair)
            onChange?.(...toEth(pair))
          }}
          className="relative flex h-5 w-full touch-none items-center select-none"
        >
          <SliderPrimitive.Track className="relative h-0.5 grow rounded-full bg-primary/50">
            <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
          </SliderPrimitive.Track>
          {[t('catalog.filters.priceMin'), t('catalog.filters.priceMax')].map((label, index) => (
            <SliderPrimitive.Thumb
              key={label}
              aria-label={label}
              aria-valuetext={formatEth(fromSteps(draft[index] ?? lo))}
              className="block size-3.5 rounded-full border-2 border-primary bg-primary shadow-sm transition-shadow hover:ring-4 hover:ring-ring/40 focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:outline-none"
            />
          ))}
        </SliderPrimitive.Root>
      ) : (
        <Skeleton className="h-5 w-full" />
      )}
      <p className="text-xs text-foreground" aria-live="polite">
        {t('catalog.filters.priceValue', {
          min: formatEth(fromSteps(draft[0])).replace(' ETH', ''),
          max: formatEth(fromSteps(draft[1])),
        })}
      </p>
      {onApply && (
        <Button
          type="button"
          size="sm"
          onClick={() => onApply(...toEth(draft))}
          className="h-7 w-fit rounded-sm px-2.5 text-xs font-bold"
          disabled={!range}
        >
          {t('catalog.filters.apply')}
        </Button>
      )}
    </fieldset>
  )
}

export function FilterPanel({
  facets,
  value,
  onToggleCategory,
  onToggleNetwork,
  onPriceChange,
  onPriceApply,
  priceKey,
  className,
}: {
  facets: Facets | undefined
  value: FilterValue
  onToggleCategory: (category: Category) => void
  onToggleNetwork: (network: Network) => void
  onPriceChange?: (min: Eth | undefined, max: Eth | undefined) => void
  onPriceApply?: (min: Eth | undefined, max: Eth | undefined) => void
  /** Changing it restarts the slider from `value` (the applied filters, not a live draft). */
  priceKey?: string
  className?: string
}) {
  const t = useT()
  const range = facets?.priceRange
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <OptionList
        legend={t('catalog.filters.categories')}
        options={CATEGORIES}
        selected={value.category}
        counts={facets?.categories}
        label={(c) => t(`catalog.category.${c}`)}
        onToggle={onToggleCategory}
      />
      <PriceRange
        // A new range or newly applied prices start the slider over.
        key={`${range?.min}-${range?.max}-${priceKey ?? `${value.minPrice}-${value.maxPrice}`}`}
        range={range}
        value={[value.minPrice, value.maxPrice]}
        onChange={onPriceChange}
        onApply={onPriceApply}
      />
      <OptionList
        legend={t('catalog.filters.network')}
        options={NETWORKS}
        selected={value.network}
        counts={facets?.networks}
        label={(n) => t(`catalog.network.${n}`)}
        onToggle={onToggleNetwork}
      />
    </div>
  )
}
