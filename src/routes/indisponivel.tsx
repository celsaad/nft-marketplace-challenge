import { createFileRoute, Link } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import { Button } from '@/ui/primitives/button'

export const Route = createFileRoute('/indisponivel')({
  component: Unavailable,
})

function Unavailable() {
  const t = useT()
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{t('unavailable.title')}</h1>
      <p className="text-muted-foreground">{t('unavailable.body')}</p>
      <Button asChild>
        <Link to="/">{t('unavailable.back')}</Link>
      </Button>
    </section>
  )
}
