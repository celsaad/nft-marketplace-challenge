import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { Footer } from '@/app/shell/footer'
import { Header } from '@/app/shell/header'
import { MobileTabBar } from '@/app/shell/mobile-tab-bar'
import { useT } from '@/lib/i18n'
import { Announcer } from '@/ui/announcer'
import { Button } from '@/ui/primitives/button'
import { Toaster } from '@/ui/primitives/sonner'
import { SectionBoundary } from '@/ui/section-boundary'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const t = useT()
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('nav.skipToContent')}
      </a>
      <SectionBoundary quiet>
        <Header />
      </SectionBoundary>
      <main id="main" tabIndex={-1} className="min-h-dvh outline-none">
        <Outlet />
      </main>
      <SectionBoundary quiet>
        <Footer />
        <MobileTabBar />
      </SectionBoundary>
      <Announcer />
      <Toaster position="top-center" />
    </>
  )
}

function NotFound() {
  const t = useT()
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <p aria-hidden className="text-5xl font-bold text-highlight">
        404
      </p>
      <h1 className="text-2xl font-bold">{t('notFound.title')}</h1>
      <p className="text-muted-foreground">{t('notFound.body')}</p>
      <Button asChild>
        <Link to="/">{t('notFound.back')}</Link>
      </Button>
    </section>
  )
}
