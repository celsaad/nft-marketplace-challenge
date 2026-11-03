// Mobile bottom navigation from the Figma: home, favorites, scan (out of scope), cart, profile.
import { Link } from '@tanstack/react-router'
import { HeartIcon, HouseIcon, ScanLineIcon, ShoppingCartIcon, UserIcon } from 'lucide-react'
import { useCartCount } from '@/features/cart/queries'
import { useT } from '@/lib/i18n'
import { notifyUnavailable } from '../unavailable'

const tab =
  'flex size-12 items-center justify-center rounded-full text-muted-foreground data-[status=active]:text-primary'

export function MobileTabBar() {
  const t = useT()
  const cartCount = useCartCount()
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-md items-center justify-around px-4">
        <li>
          <Link to="/" className={tab} aria-label={t('nav.home')} activeOptions={{ exact: true }}>
            <HouseIcon aria-hidden />
          </Link>
        </li>
        <li>
          <Link to="/" search={{ favorites: true }} className={tab} aria-label={t('nav.favorites')}>
            <HeartIcon aria-hidden />
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={() => notifyUnavailable()}
            aria-label={t('unavailable.toast')}
            className="-mt-8 grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
          >
            <ScanLineIcon aria-hidden />
          </button>
        </li>
        <li>
          <Link
            to="/carrinho"
            className={`${tab} relative`}
            aria-label={t('header.cartCount', { count: cartCount })}
          >
            <ShoppingCartIcon aria-hidden />
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
            <UserIcon aria-hidden />
          </Link>
        </li>
      </ul>
    </nav>
  )
}
