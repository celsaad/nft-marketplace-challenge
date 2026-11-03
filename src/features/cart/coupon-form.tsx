// Apply or remove the Cart's single Coupon. Errors come back from the API as i18n keys on
// `fieldErrors.code` (coupon.invalid / coupon.expired / coupon.minimum) and sit under the field.
import { Loader2Icon, TicketIcon, XIcon } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { isApiError } from '@/app/api/errors'
import { ApplyCouponInputSchema } from '@/contracts/purchase'
import { useT } from '@/lib/i18n'
import { errorMessageKey } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'
import { Label } from '@/ui/primitives/label'
import { useApplyCoupon, useRemoveCoupon } from './mutations'

export function CouponForm({
  couponCode,
  say,
  inputId,
}: {
  couponCode: string | null
  say: (text: string) => void
  /** Lets the checkout's "Tem um código promocional?" link focus this field. */
  inputId?: string
}) {
  const t = useT()
  const fallbackId = useId()
  const id = inputId ?? fallbackId
  const errorId = `${id}-error`
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = ApplyCouponInputSchema.safeParse({ code })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'validation.required')
      return
    }
    apply.mutate(parsed.data.code, {
      onSuccess: (cart) => {
        setError(null)
        setCode('')
        say(t('purchase.coupon.applied', { code: cart.couponCode ?? parsed.data.code }))
      },
      onError: (e) => {
        const key = (isApiError(e) && e.fieldErrors.code) || errorMessageKey(e)
        setError(key)
        say(t(key))
      },
    })
  }

  if (couponCode) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-primary/60 px-3 py-2">
        <p className="flex items-center gap-2 text-sm">
          <TicketIcon aria-hidden className="size-4 text-primary" />
          {t('purchase.coupon.applied', { code: couponCode })}
        </p>
        <button
          type="button"
          className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-primary-hover disabled:opacity-50"
          aria-label={t('purchase.coupon.remove', { code: couponCode })}
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => say(t('purchase.coupon.removed')),
              onError: (e) => say(t(errorMessageKey(e))),
            })
          }
        >
          {remove.isPending ? (
            <Loader2Icon aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <XIcon aria-hidden className="size-4" />
          )}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <Label htmlFor={id} className="sr-only text-[13px] font-bold md:not-sr-only">
        {t('purchase.coupon.label')}
      </Label>
      <div className="flex">
        <input
          id={id}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (error) setError(null)
          }}
          placeholder={t('purchase.coupon.placeholder')}
          autoComplete="off"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-14 min-w-0 flex-1 rounded-l-full border border-r-0 border-input bg-transparent px-6 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 md:h-10 md:rounded-l-none md:border-primary/70 md:px-2 md:text-xs',
            error && 'border-destructive md:border-destructive',
          )}
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className="-ml-6 inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-[#b97c48] px-7 text-lg font-bold text-primary-foreground transition-colors hover:from-primary-hover disabled:opacity-70 md:ml-0 md:h-10 md:rounded-none md:bg-primary md:bg-none md:px-5 md:text-sm"
        >
          {apply.isPending && (
            <Loader2Icon aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          )}
          {t('purchase.coupon.apply')}
        </button>
      </div>
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {t(error)}
        </p>
      )}
    </form>
  )
}
