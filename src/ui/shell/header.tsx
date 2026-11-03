// Desktop/tablet header from the Figma: logo, primary navigation, search, cart, account.
import { Link } from '@tanstack/react-router'
import { LogInIcon, SearchIcon, ShoppingCartIcon, UserIcon } from 'lucide-react'
import { logout } from '@/app/session/session'
import { useMe } from '@/features/account/queries'
import { useCartCount } from '@/features/cart/queries'
import { useT } from '@/lib/i18n'
import { Button } from '../primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../primitives/dropdown-menu'
import { LocaleSwitch } from './locale-switch'

const navLink =
  'relative py-2 text-sm text-foreground transition-colors hover:text-primary-hover data-[status=active]:font-bold data-[status=active]:text-primary data-[status=active]:after:absolute data-[status=active]:after:inset-x-0 data-[status=active]:after:-bottom-2 data-[status=active]:after:h-0.5 data-[status=active]:after:bg-primary'

export function Header() {
  const t = useT()
  const me = useMe()
  const cartCount = useCartCount()

  return (
    <header className="border-b border-border/60">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:px-6">
        <Link
          to="/"
          className="text-sm font-bold tracking-[0.2em]"
          aria-label={`${t('brand.name')} — ${t('nav.home')}`}
        >
          {t('brand.name')}
        </Link>

        <nav aria-label={t('nav.main')} className="hidden md:block">
          <ul className="flex items-center gap-8">
            <li>
              <Link to="/" className={navLink} activeOptions={{ exact: true }}>
                {t('nav.home')}
              </Link>
            </li>
            <li>
              <Link
                to="/"
                hash="mercado"
                className={navLink}
                activeOptions={{ exact: true, includeHash: true }}
              >
                {t('nav.market')}
              </Link>
            </li>
            <li>
              <Link to="/indisponivel" className={navLink}>
                {t('nav.creators')}
              </Link>
            </li>
            <li>
              <Link to="/indisponivel" className={navLink}>
                {t('nav.learn')}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitch />
          <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex">
            <Link to="/" hash="mercado" aria-label={t('header.search')}>
              <SearchIcon aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="relative">
            <Link to="/carrinho" aria-label={t('header.cartCount', { count: cartCount })}>
              <ShoppingCartIcon aria-hidden />
              {cartCount > 0 && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </Button>

          {me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-primary text-primary">
                  <UserIcon aria-hidden />
                  <span className="max-w-28 truncate">{me.displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/perfil">{t('nav.profile')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/carteiras">{t('nav.wallets')}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logout()}>{t('header.logout')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary-hover">
              <Link to="/entrar">
                <LogInIcon aria-hidden />
                {t('header.login')}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
