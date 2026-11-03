// Create/edit Wallet dialog (shadcn Dialog: focus is trapped while open, Esc closes). The form
// uses the shared WalletInputSchema, so an address that doesn't fit its Network fails here with
// the same message key the API would answer with.
import { zodResolver } from '@hookform/resolvers/zod'
import { XIcon } from 'lucide-react'
import { useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { isApiError } from '@/app/api/errors'
import { WALLET_PROVIDERS, type Wallet, WalletInputSchema } from '@/contracts/account'
import { NETWORKS } from '@/contracts/common'
import { applyFieldErrors, isSessionLoss } from '@/features/auth/form-errors'
import { SubmitButton } from '@/features/auth/submit-button'
import { useT } from '@/lib/i18n'
import { errorMessageKey } from '@/ui/feedback'
import { FormField } from '@/ui/form-field'
import { Button } from '@/ui/primitives/button'
import { Checkbox } from '@/ui/primitives/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/primitives/dialog'
import { Input } from '@/ui/primitives/input'
import { Label } from '@/ui/primitives/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/select'
import { networkLabel, providerLabel } from './format'
import { useSaveWallet } from './queries'

type WalletForm = z.input<typeof WalletInputSchema>

/** What the dialog is editing, and which control gets focus back when it closes. */
export interface WalletDialogTarget {
  wallet?: Wallet
  primary: boolean
  /** The id of the element that opened the dialog (it may have moved after a save). */
  returnFocusTo: string
}

// An unselected Network/Provider is "required", not zod's generic enum message.
const resolver = zodResolver(WalletInputSchema, {
  error: (issue) => (issue.input === undefined || issue.input === '' ? 'validation.required' : undefined),
})

export function WalletDialog({
  collectorId,
  target,
  open,
  onOpenChange,
}: {
  collectorId: string
  target: WalletDialogTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-sm border-border bg-card sm:max-w-[520px]"
        onCloseAutoFocus={(event) => {
          // Radix only knows a DialogTrigger; these dialogs open from several buttons.
          event.preventDefault()
          if (target) document.getElementById(target.returnFocusTo)?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {t(target?.wallet ? 'account.wallets.dialogEditTitle' : 'account.wallets.dialogAddTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs">{t('account.wallets.dialogDescription')}</DialogDescription>
        </DialogHeader>
        {target && (
          <WalletFormBody collectorId={collectorId} target={target} onDone={() => onOpenChange(false)} />
        )}
        <DialogClose
          aria-label={t('account.auth.close')}
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-sm text-primary hover:text-primary-hover"
        >
          <XIcon aria-hidden className="size-5" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function WalletFormBody({
  collectorId,
  target,
  onDone,
}: {
  collectorId: string
  target: WalletDialogTarget
  onDone: () => void
}) {
  const t = useT()
  const primaryId = useId()
  const save = useSaveWallet(collectorId)
  const { wallet } = target
  const form = useForm<WalletForm>({
    resolver,
    defaultValues: wallet
      ? {
          label: wallet.label,
          address: wallet.address,
          network: wallet.network,
          provider: wallet.provider,
          isPrimary: wallet.isPrimary,
        }
      : { label: '', address: '', isPrimary: target.primary },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: wallet?.id, input: WalletInputSchema.parse(values) })
    } catch (error) {
      if (isSessionLoss(error)) return
      const onField = applyFieldErrors(error, form.setError, ['label', 'address', 'network', 'provider'])
      if (!onField) {
        form.setError('root', {
          message: isApiError(error) ? errorMessageKey(error) : 'error.unknown',
        })
      }
      return
    }
    toast.success(t('account.wallets.saved'))
    onDone()
  })

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormField label={t('account.wallets.fieldLabel')} error={errors.label?.message} required>
        <Input autoComplete="off" className="h-10 bg-transparent" {...form.register('label')} />
      </FormField>

      <Controller
        control={form.control}
        name="network"
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange} name={field.name}>
            <FormField label={t('account.wallets.fieldNetwork')} error={errors.network?.message} required>
              <SelectTrigger ref={field.ref} onBlur={field.onBlur} className="h-10 w-full">
                <SelectValue placeholder={t('account.wallets.fieldNetworkPlaceholder')} />
              </SelectTrigger>
            </FormField>
            <SelectContent position="popper">
              {NETWORKS.map((network) => (
                <SelectItem key={network} value={network}>
                  {t(networkLabel(network))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      <FormField
        label={t('account.wallets.fieldAddress')}
        error={errors.address?.message}
        description={t('account.wallets.fieldAddressHint')}
        required
      >
        <Input
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={t('account.wallets.fieldAddressPlaceholder')}
          className="h-10 bg-transparent font-mono"
          {...form.register('address')}
        />
      </FormField>

      <Controller
        control={form.control}
        name="provider"
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange} name={field.name}>
            <FormField label={t('account.wallets.fieldProvider')} error={errors.provider?.message} required>
              <SelectTrigger ref={field.ref} onBlur={field.onBlur} className="h-10 w-full">
                <SelectValue placeholder={t('account.wallets.fieldProviderPlaceholder')} />
              </SelectTrigger>
            </FormField>
            <SelectContent position="popper">
              {WALLET_PROVIDERS.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {t(providerLabel(provider))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      <Controller
        control={form.control}
        name="isPrimary"
        render={({ field }) => (
          <div className="flex items-center gap-3">
            <Checkbox
              id={primaryId}
              ref={field.ref}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
              // A Collector always keeps one Primary Wallet: it moves by marking another one.
              disabled={wallet?.isPrimary}
            />
            <Label htmlFor={primaryId} className="font-normal">
              {t('account.wallets.fieldPrimary')}
            </Label>
          </div>
        )}
      />

      {errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {t(errors.root.message)}
        </p>
      )}

      <DialogFooter className="mt-2 gap-3">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="h-10">
            {t('account.wallets.cancel')}
          </Button>
        </DialogClose>
        <SubmitButton pending={save.isPending} className="h-10 px-6 font-bold hover:bg-primary-hover">
          {t('account.wallets.save')}
        </SubmitButton>
      </DialogFooter>
    </form>
  )
}
