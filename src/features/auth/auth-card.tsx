// The "Entrar | Criar conta" panel from the Figma. Desktop draws it as a modal over the dimmed home
// page; here it is its own route (so `redirect`/`reason` live in the URL and survive a refresh), and
// the home behind it is a decorative, inert copy. Mobile follows the full-screen frames: big logo,
// title, form, switch link.
import { Link, useRouter } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { PromoCards } from '@/features/catalog/editorial'
import { Hero } from '@/features/catalog/hero'
import { useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { notifyUnavailable } from '@/ui/unavailable'

type Mode = 'login' | 'signup'

const tab = 'rounded-sm px-1 transition-colors hover:text-primary-hover aria-[current=page]:text-highlight'

export function AuthCard({
  mode,
  redirect,
  intro,
  mobileTitle,
  notice,
  children,
  footer,
}: {
  mode: Mode
  redirect?: string
  intro: string
  mobileTitle: string
  notice?: ReactNode
  children: ReactNode
  footer: ReactNode
}) {
  const t = useT()
  const router = useRouter()
  const search = { redirect }

  return (
    <div className="relative md:overflow-hidden">
      <div aria-hidden inert className="pointer-events-none absolute inset-0 hidden md:block">
        <div className="flex flex-col gap-16 pt-6">
          <Hero />
          <PromoCards />
        </div>
      </div>
      <div className="relative px-4 pt-10 pb-28 md:bg-background/75 md:px-6 md:pt-[90px] md:pb-24">
        <section
          aria-labelledby="auth-title"
          className="relative mx-auto max-w-[500px] md:overflow-hidden md:bg-card md:shadow-2xl"
        >
          <button
            type="button"
            onClick={() => router.history.push(redirect ?? '/')}
            aria-label={t('account.auth.close')}
            className="absolute top-3 right-3 hidden size-8 place-items-center rounded-sm text-highlight hover:text-primary-hover md:grid"
          >
            <XIcon aria-hidden className="size-5" />
          </button>

          <p aria-hidden className="mb-24 text-center text-[32px] font-bold tracking-[0.12em] md:hidden">
            {t('brand.name')}
          </p>

          <h1 id="auth-title" className="text-center text-xl font-bold md:sr-only">
            {mode === 'login' ? t('account.auth.login') : mobileTitle}
          </h1>

          <nav
            aria-label={t('account.auth.tabs')}
            className="hidden items-center justify-center gap-1 pt-12 text-xl font-medium tracking-wide md:flex"
          >
            <Link
              to="/entrar"
              search={search}
              className={tab}
              aria-current={mode === 'login' ? 'page' : undefined}
            >
              {t('account.auth.login')}
            </Link>
            <span aria-hidden className="h-6 w-px bg-primary" />
            <Link
              to="/cadastro"
              search={search}
              className={tab}
              aria-current={mode === 'signup' ? 'page' : undefined}
            >
              {t('account.auth.signup')}
            </Link>
          </nav>

          <p className="mx-auto mt-10 hidden max-w-[400px] text-center text-xs leading-4 tracking-wide md:block md:text-[13px]">
            {intro}
          </p>

          <div className="mx-auto mt-10 max-w-[340px] md:mt-6">
            {notice}
            {children}
          </div>

          <SocialLogin />

          <p className="mt-12 text-center text-muted-foreground md:hidden">{footer}</p>
          <div aria-hidden className="mt-12 hidden h-2.5 bg-primary md:block" />
        </section>
      </div>
    </div>
  )
}

function SocialLogin() {
  const t = useT()
  const social =
    'flex h-12 w-full items-center justify-center gap-3 rounded-md border border-border text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground md:h-10 md:text-[13px]'
  return (
    <div className="mt-8 md:mt-6">
      <div className="flex items-center gap-5 md:gap-3">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <p className="text-[13px]">{t('account.auth.orContinueWith')}</p>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <div className="mx-auto mt-4 flex max-w-[340px] flex-col gap-3">
        <button type="button" className={social} onClick={() => notifyUnavailable()}>
          <GoogleMark />
          {t('account.auth.google')}
        </button>
        <button type="button" className={social} onClick={() => notifyUnavailable()}>
          <FacebookMark />
          {t('account.auth.facebook')}
        </button>
      </div>
    </div>
  )
}

/** Brand marks drawn inline (no icon font or remote asset); decorative, the text names the action. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
      />
    </svg>
  )
}

function FacebookMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <path
        fill="#3B5998"
        d="M14 8V6c0-.9.6-1.1 1-1.1h2.6V1h-3.6C10 1 9.3 3.8 9.3 5.6V8H7v4h2.3v11H14V12h3.2l.4-4H14Z"
      />
    </svg>
  )
}

/** Shared look of the auth inputs: the Figma's taller, rounder fields on mobile. */
export const authInput = cn('h-12 rounded-xl px-4 text-base md:h-10 md:rounded-md md:text-sm')
export const authSubmit = cn(
  'h-14 w-full rounded-xl text-base font-bold hover:bg-primary-hover md:h-11 md:rounded-md md:text-sm',
)
