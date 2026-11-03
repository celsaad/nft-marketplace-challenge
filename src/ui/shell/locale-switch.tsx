import { LanguagesIcon } from 'lucide-react'
import { LOCALES } from '@/contracts/common'
import { setLocale, useLocale, useT } from '@/lib/i18n'
import { Button } from '../primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../primitives/dropdown-menu'

export function LocaleSwitch() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${t('locale.label')}: ${t(`locale.${locale}`)}`}>
          <LanguagesIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as typeof locale)}>
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
