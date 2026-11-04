// Mobile bottom navigation from the Figma: home, favorites, scan (out of scope), cart, profile.
// The panel is the Figma's "Tab Bar" vector: rounded top corners and a concave notch in the middle,
// where the scan button floats on its own translucent gradient.
import { Link } from '@tanstack/react-router'
import { HeartIcon, HouseIcon, ScanLineIcon, ShoppingCartIcon, UserIcon } from 'lucide-react'
import { useCartCount } from '@/features/cart/queries'
import { useT } from '@/lib/i18n'
import { notifyUnavailable } from '@/ui/unavailable'

const tab =
  'flex size-12 items-center justify-center rounded-full text-muted-foreground data-[status=active]:text-highlight'

/** The notch section of the Figma path (x 131.15–282.85 of its 414 × 95 vector). */
const NOTCH =
  'M0 0C13.75 0 25.98 8.2 31.83 20.65C39.59 37.18 56.39 48.62 75.85 48.62C95.31 48.62 112.11 37.17 119.87 20.65C125.72 8.2 137.94 0 151.7 0V95H0Z'

export function MobileTabBar() {
  const t = useT()
  const cartCount = useCartCount()
  return (
    <nav
      data-tab-bar
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-40 drop-shadow-[0_-10px_30px_rgb(10_6_4/0.45)] md:hidden"
    >
      {/* The panel: two flat sides and the notch between them, so the notch keeps its shape at any width. */}
      <div aria-hidden className="absolute inset-0 flex">
        <div className="-mr-px flex-1 rounded-tl-[29px] bg-card" />
        <svg
          viewBox="0 0 151.7 95"
          preserveAspectRatio="none"
          className="h-full w-[152px] shrink-0 fill-card"
        >
          <path d={NOTCH} />
        </svg>
        <div className="-ml-px flex-1 rounded-tr-[29px] bg-card" />
      </div>
      <ul className="relative mx-auto grid h-[95px] max-w-md grid-cols-[1fr_1fr_152px_1fr_1fr] items-start justify-items-center px-2 pt-[26px] pb-[env(safe-area-inset-bottom)]">
        <li>
          <Link to="/" className={tab} aria-label={t('nav.home')} activeOptions={{ exact: true }}>
            <HouseIcon aria-hidden className="size-5 fill-current" />
          </Link>
        </li>
        <li>
          <Link to="/" search={{ favorites: true }} className={tab} aria-label={t('nav.favorites')}>
            <HeartIcon aria-hidden className="size-5 fill-current" />
          </Link>
        </li>
        <li className="self-stretch">
          <button
            type="button"
            onClick={() => notifyUnavailable()}
            aria-label={t('unavailable.toast')}
            className="absolute -top-[31px] left-1/2 grid size-[65px] -translate-x-1/2 place-items-center rounded-full bg-[linear-gradient(to_bottom,rgb(210_138_76/0.4),#d28a4c)] text-foreground"
          >
            <ScanLineIcon aria-hidden className="size-7" />
          </button>
        </li>
        <li>
          <Link
            to="/carrinho"
            className={`${tab} relative`}
            aria-label={t('header.cartCount', { count: cartCount })}
          >
            <ShoppingCartIcon aria-hidden className="size-5" />
            {cartCount > 0 && (
              <span
                aria-hidden
                className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
              >
                {cartCount}
              </span>
            )}
          </Link>
        </li>
        <li>
          <Link to="/perfil" className={tab} aria-label={t('nav.profile')}>
            <UserIcon aria-hidden className="size-5 fill-current" />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
