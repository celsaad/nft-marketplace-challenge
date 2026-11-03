// Dot navigation for the shadcn Carousel (Embla): one button per snap point, the current one
// marked with aria-current. Jumps instead of sliding when the Collector prefers reduced motion.
import { useCallback, useSyncExternalStore } from 'react'
import { cn } from '@/ui/lib/utils'
import type { CarouselApi } from '@/ui/primitives/carousel'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The selected snap and the snap count, kept in sync with Embla. */
export function useCarouselState(api: CarouselApi | undefined) {
  const subscribe = useCallback(
    (notify: () => void) => {
      api?.on('select', notify).on('reInit', notify)
      return () => {
        api?.off('select', notify).off('reInit', notify)
      }
    },
    [api],
  )
  const selected = useSyncExternalStore(subscribe, () => api?.selectedScrollSnap() ?? 0)
  const count = useSyncExternalStore(subscribe, () => api?.scrollSnapList().length ?? 0)
  return { selected, count }
}

export function CarouselDots({
  api,
  label,
  className,
  variant = 'filled',
}: {
  api: CarouselApi | undefined
  /** Accessible name for dot n (1-based). */
  label: (n: number) => string
  className?: string
  variant?: 'filled' | 'ring'
}) {
  const { selected, count } = useCarouselState(api)
  if (count <= 1) return null
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: snap points are positional
          key={i}
          type="button"
          aria-label={label(i + 1)}
          aria-current={i === selected ? 'true' : undefined}
          onClick={() => api?.scrollTo(i, prefersReducedMotion())}
          className="grid size-6 place-items-center rounded-full"
        >
          <span
            aria-hidden
            className={cn(
              'block size-2 rounded-full transition-colors',
              variant === 'filled' && (i === selected ? 'bg-primary' : 'bg-primary/80'),
              variant === 'ring' && (i === selected ? 'bg-primary' : 'border border-primary'),
            )}
          />
        </button>
      ))}
    </div>
  )
}
