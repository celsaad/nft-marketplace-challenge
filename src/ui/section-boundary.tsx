// Contains a crash while drawing one section (a bug, not a failed request: each query already shows
// its own error state), so the rest of the page keeps working. Secondary panels pass `quiet` and
// simply disappear, as they do when their request fails; the others say so and offer a retry.
// Navigating resets it.
import { CatchBoundary, type ErrorComponentProps, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'
import { ErrorState } from './feedback'

export function SectionBoundary({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  const href = useRouterState({ select: (state) => state.location.href })
  return (
    <CatchBoundary
      getResetKey={() => href}
      onCatch={(error) => console.error('Section crashed', error)}
      errorComponent={quiet ? Hidden : SectionCrash}
    >
      {children}
    </CatchBoundary>
  )
}

const Hidden = () => null

function SectionCrash({ error, reset }: ErrorComponentProps) {
  const t = useT()
  return <ErrorState error={error} message={t('error.section')} onRetry={reset} />
}
