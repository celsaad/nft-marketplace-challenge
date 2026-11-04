// The header's two dropdown menus (language and account). Loaded on demand by DeferredMenu, so
// the Radix menu code is not part of the startup bundle (docs/lighthouse/improvement-research.md §3).
import { Link } from '@tanstack/react-router'
import { useRef } from 'react'
import { logout } from '@/app/session/session'
import { LOCALES, type Locale } from '@/contracts/common'
import { setLocale, useLocale, useT } from '@/lib/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu'
import type { DeferredMenuProps } from './deferred-menu'

/**
 * The menu mounts already open, after the key press that asked for it, so Radix cannot tell it
 * was opened from the keyboard and focuses the menu itself. On that first open only, move focus
 * to the first item, as Radix does for a keyboard open. A ref callback on the content, deferred
 * one frame so it runs after Radix's own mount focus.
 */
function useFirstOpenFocus(openedWith: DeferredMenuProps['openedWith']) {
  const pending = useRef(openedWith === 'keyboard')
  return (content: HTMLDivElement | null) => {
    if (!content || !pending.current) return
    pending.current = false
    requestAnimationFrame(() => content.querySelector<HTMLElement>('[role^="menuitem"]')?.focus())
  }
}

export function LocaleMenu({ trigger, openedWith }: DeferredMenuProps) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const contentRef = useFirstOpenFocus(openedWith)
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent ref={contentRef} align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => void setLocale(value as Locale)}>
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} lang={option}>
              {t(`locale.${option}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AccountMenu({ trigger, openedWith }: DeferredMenuProps) {
  const t = useT()
  const contentRef = useFirstOpenFocus(openedWith)
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent ref={contentRef} align="end">
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
  )
}
