// Shared states every data-dependent screen uses: shimmer skeletons, errors with retry,
// and a quiet "refreshing" hint for background refetches.
import { RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { type ApiError, isApiError } from '@/app/api/errors'
import { type MessageKey, useT } from '@/lib/i18n'
import { cn } from './lib/utils'
import { Button } from './primitives/button'

/** Placeholder with the real content's dimensions (no layout shift) and a reduced-motion-safe shimmer. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton-shimmer rounded-md', className)} {...props} />
}

/** Wraps skeletons so assistive tech hears one "loading" instead of nothing. */
export function LoadingRegion({ children, className }: { children: ReactNode; className?: string }) {
  const t = useT()
  return (
    // <output> may only hold phrasing content; these skeletons are blocks, so the role is explicit.
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    <div role="status" aria-busy="true" aria-label={t('a11y.loading')} className={className}>
      {children}
    </div>
  )
}

const MESSAGE_BY_KIND: Partial<Record<ApiError['kind'], MessageKey>> = {
  network: 'error.network',
  timeout: 'error.timeout',
  transient: 'error.transient',
  forbidden: 'error.forbidden',
  notFound: 'error.notFound',
}

/** The message key for any error, so every screen words failures the same way. */
export function errorMessageKey(error: unknown): MessageKey {
  return (isApiError(error) && MESSAGE_BY_KIND[error.kind]) || 'error.unknown'
}

export function ErrorState({
  error,
  onRetry,
  className,
  title,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
  title?: string
}) {
  const t = useT()
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center',
        className,
      )}
    >
      <TriangleAlertIcon aria-hidden className="size-6 text-destructive" />
      <p className="font-bold">{title ?? t('error.title')}</p>
      <p className="text-sm text-muted-foreground">{t(errorMessageKey(error))}</p>
      {onRetry && (
        <Button type="button" onClick={onRetry}>
          <RefreshCwIcon aria-hidden />
          {t('state.retry')}
        </Button>
      )}
    </div>
  )
}

/** Shown while cached data is refetched in the background (data stays visible). */
export function RefreshingHint({ active }: { active: boolean }) {
  const t = useT()
  if (!active) return null
  return (
    <output className="inline-flex items-center gap-1 text-xs text-subtle-foreground">
      <RefreshCwIcon aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />
      {t('state.refreshing')}
    </output>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-bold">{title}</p>
      {children}
    </div>
  )
}
