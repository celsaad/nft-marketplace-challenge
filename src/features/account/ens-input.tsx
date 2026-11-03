// The Figma's ENS field: ".eth" sits beside the name. Shared by the profile and Wallet forms;
// FormField's id and aria wiring reach the input through the props.
import type { ComponentProps } from 'react'
import { useT } from '@/lib/i18n'
import { Input } from '@/ui/primitives/input'

export function EnsInput(props: ComponentProps<'input'>) {
  const t = useT()
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden
        className="grid h-10 w-[78px] shrink-0 place-items-center rounded-md border border-input text-sm"
      >
        {t('account.profile.ensSuffix')}
      </span>
      <Input
        autoCapitalize="none"
        spellCheck={false}
        placeholder="anasouza"
        className="h-10 bg-transparent"
        {...props}
      />
    </div>
  )
}

/** Form value (name only) → contract value (`name.eth`). */
export const withEthSuffix = (name: string) => {
  const bare = name
    .trim()
    .toLowerCase()
    .replace(/\.eth$/, '')
  return bare ? `${bare}.eth` : ''
}

/** Contract value (`name.eth`) → form value (name only). */
export const withoutEthSuffix = (ens: string | null | undefined) => ens?.replace(/\.eth$/, '') ?? ''
