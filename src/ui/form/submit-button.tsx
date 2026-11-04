// Submit buttons are disabled with a spinner while pending, never debounced (docs/decisions.md
// §Interaction safety): a second click can't send a second request.
import { LoaderCircleIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/ui/primitives/button'

export function SubmitButton({
  pending,
  children,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending && <LoaderCircleIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}
      {children}
    </Button>
  )
}
