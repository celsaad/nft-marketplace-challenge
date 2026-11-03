// The "Meu perfil" sidebar shared by the profile and wallet screens. Items outside the demo
// (activity, offers, …) render as drawn and lead to the honest "not available" page. There is
// no mobile frame for these screens, so on phones the sidebar collapses to the in-scope links.
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ChartSplineIcon,
  DownloadIcon,
  HeartIcon,
  LogOutIcon,
  MapPinIcon,
  ShoppingCartIcon,
  TriangleAlertIcon,
  UserIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { logout } from '@/app/session/session'
import { type MessageKey, useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { UnavailableLink } from '@/ui/unavailable'

const OUT_OF_SCOPE: { label: MessageKey; icon: typeof UserIcon }[] = [
  { label: 'account.nav.activity', icon: ShoppingCartIcon },
  { label: 'account.nav.watchlist', icon: HeartIcon },
  { label: 'account.nav.offers', icon: ChartSplineIcon },
  { label: 'account.nav.downloads', icon: DownloadIcon },
  { label: 'account.nav.support', icon: TriangleAlertIcon },
]

const item =
  'relative flex items-center gap-3 rounded-sm px-4 py-2.5 text-sm text-primary transition-colors hover:text-primary-hover md:py-3'
const activeItem =
  'data-[status=active]:bg-surface-raised data-[status=active]:font-medium md:data-[status=active]:bg-transparent md:data-[status=active]:before:absolute md:data-[status=active]:before:inset-y-0 md:data-[status=active]:before:left-0 md:data-[status=active]:before:w-1.5 md:data-[status=active]:before:bg-primary'

export function AccountLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const navigate = useNavigate()

  // Leave the private screen first, so the guard doesn't read the logout as "login required".
  const onLogout = async () => {
    await navigate({ to: '/' })
    await logout()
  }

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pt-6 pb-28 md:flex-row md:gap-7 md:px-6 md:pt-8 md:pb-24">
      <aside className="shrink-0 rounded-sm bg-card md:w-[310px] md:self-start">
        <p className="px-2.5 pt-4 pb-2 text-lg font-bold md:pt-5">{t('account.nav.title')}</p>
        <nav aria-label={t('account.nav.label')}>
          <ul className="flex flex-wrap px-1 pb-2 md:flex-col md:px-0 md:pb-0">
            <li>
              <Link to="/perfil" className={cn(item, activeItem)}>
                <UserIcon aria-hidden className="size-4" />
                {t('account.nav.profile')}
              </Link>
            </li>
            <li>
              <Link to="/carteiras" className={cn(item, activeItem)}>
                <MapPinIcon aria-hidden className="size-4" />
                {t('account.nav.wallets')}
              </Link>
            </li>
            {OUT_OF_SCOPE.map(({ label, icon: Icon }) => (
              <li key={label} className="hidden md:block">
                <UnavailableLink className={item}>
                  <Icon aria-hidden className="size-4" />
                  {t(label)}
                </UnavailableLink>
              </li>
            ))}
            <li className="md:mt-0 md:border-t md:border-border md:py-1">
              <button type="button" onClick={() => void onLogout()} className={cn(item, 'w-full font-bold')}>
                <LogOutIcon aria-hidden className="size-4" />
                {t('account.nav.logout')}
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
