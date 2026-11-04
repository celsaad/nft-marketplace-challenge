import { LanguagesIcon } from 'lucide-react'
import { useLocale, useT } from '@/lib/i18n'
import { Button } from '@/ui/primitives/button'
import { DeferredMenu, LocaleMenu } from './deferred-menu'

export function LocaleSwitch() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  return (
    <DeferredMenu
      menu={LocaleMenu}
      trigger={
        <Button variant="ghost" size="icon" aria-label={`${t('locale.label')}: ${t(`locale.${locale}`)}`}>
          <LanguagesIcon aria-hidden />
        </Button>
      }
    />
  )
}
