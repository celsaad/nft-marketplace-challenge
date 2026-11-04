// Password field with the Figma's eye toggle. The toggle is a real button with a state-describing
// name, so keyboard and screen reader users can reveal what they typed too.
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { type ComponentProps, useState } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { Input } from '@/ui/primitives/input'

export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const t = useT()
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={t('account.auth.showPassword')}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-subtle-foreground hover:text-highlight"
      >
        {visible ? <EyeIcon aria-hidden className="size-4" /> : <EyeOffIcon aria-hidden className="size-4" />}
      </button>
    </div>
  )
}
