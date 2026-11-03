// Out-of-scope actions render as drawn but never pretend to succeed (spec §Escopo).
import { Link } from '@tanstack/react-router'
import type { ComponentProps, MouseEvent } from 'react'
import { toast } from 'sonner'
import { t as translate } from '@/lib/i18n'
import { cn } from './lib/utils'

/** For buttons/forms that would do something out of scope: say so, change nothing. */
export function notifyUnavailable(event?: { preventDefault(): void }) {
  event?.preventDefault()
  toast.info(translate('unavailable.toast'))
}

/** A navigation link to an out-of-scope area: goes to the honest "not in this demo" page. */
export function UnavailableLink({ className, children, ...props }: Omit<ComponentProps<'a'>, 'href'>) {
  return (
    <Link to="/indisponivel" className={cn(className)} {...(props as object)}>
      {children}
    </Link>
  )
}

export const preventAndNotify = (event: MouseEvent) => notifyUnavailable(event)
