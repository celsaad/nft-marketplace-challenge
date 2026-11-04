// The router's default error screen: a route that crashes while loading or drawing shows this inside
// the app shell (header and footer keep working), in the app's look and language, with a retry that
// reloads the route's data and a way home. Failed requests have their own states; this is for bugs.
import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import { ErrorState } from '@/ui/feedback'
import { Button } from '@/ui/primitives/button'

export function RouteError({ error, reset }: ErrorComponentProps) {
  const t = useT()
  const router = useRouter()
  const retry = () => {
    reset()
    void router.invalidate()
  }
  return (
    <section className="mx-auto max-w-xl px-4 py-24">
      <ErrorState error={error} message={t('error.page')} onRetry={retry}>
        <Button asChild variant="outline">
          <Link to="/">{t('error.home')}</Link>
        </Button>
      </ErrorState>
    </section>
  )
}
