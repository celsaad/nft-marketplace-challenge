// What changed in the Cart since the Collector last looked (price, availability, Coupon), in a
// polite live region so the change is announced as well as shown.
import { TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import type { Quote, QuoteIssue } from '@/contracts/purchase'
import { type MessageKey, useT } from '@/lib/i18n'
import { formatEth } from '@/lib/money/eth'
import { cn } from '@/ui/lib/utils'
import { Button } from '@/ui/primitives/button'

const COUPON_REASON: Record<string, MessageKey> = {
  invalid: 'coupon.invalid',
  expired: 'coupon.expired',
  'minimum-not-met': 'coupon.minimum',
}

export function useIssueText(names: ReadonlyMap<string, string>) {
  const t = useT()
  return (issue: QuoteIssue): string => {
    if (issue.kind === 'coupon-dropped') {
      return t('purchase.issues.couponDropped', {
        code: issue.code,
        reason: t(COUPON_REASON[issue.reason] ?? 'coupon.invalid'),
      })
    }
    const name = names.get(issue.lineId) ?? t('purchase.issues.unknownItem')
    switch (issue.kind) {
      case 'price-changed':
        return t('purchase.issues.priceChanged', {
          name,
          from: formatEth(issue.from),
          to: formatEth(issue.to),
        })
      case 'quantity-reduced':
        return t('purchase.issues.quantityReduced', { name, from: issue.from, to: issue.to })
      case 'sold-out':
        return t('purchase.issues.soldOut', { name })
    }
  }
}

export function IssueList({
  issues,
  names,
}: {
  issues: readonly QuoteIssue[]
  names: ReadonlyMap<string, string>
}) {
  const text = useIssueText(names)
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
      {issues.map((issue) => (
        <li key={JSON.stringify(issue)}>{text(issue)}</li>
      ))}
    </ul>
  )
}

/**
 * The server reports each change in exactly one Quote, so the issues stay on screen until the
 * Collector dismisses them, even after the Quote is refetched.
 */
export function useReportedIssues(quote: Quote | undefined) {
  const [issues, setIssues] = useState<readonly QuoteIssue[]>([])
  const [seen, setSeen] = useState<readonly QuoteIssue[] | undefined>(undefined)
  const reported = quote?.issues
  // Adjusting state while rendering: each new Quote's issues replace the ones on screen.
  if (reported !== seen) {
    setSeen(reported)
    if (reported && reported.length > 0) setIssues(reported)
  }
  return { issues, dismiss: () => setIssues([]) }
}

export function QuoteIssuesNotice({
  issues,
  names,
  onDismiss,
  className,
}: {
  issues: readonly QuoteIssue[]
  names: ReadonlyMap<string, string>
  onDismiss: () => void
  className?: string
}) {
  const t = useT()
  return (
    // The live region exists before its content arrives, so screen readers announce the change.
    <output aria-live="polite" className={cn('block', issues.length === 0 && 'sr-only', className)}>
      {issues.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/60 bg-band p-4">
          <span className="flex items-center gap-2 font-bold">
            <TriangleAlertIcon aria-hidden className="size-4 text-highlight" />
            {t('purchase.issues.title')}
          </span>
          <IssueList issues={issues} names={names} />
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={onDismiss}>
            {t('purchase.issues.dismiss')}
          </Button>
        </div>
      )}
    </output>
  )
}
