// Inline Wallet form, field for field as the Figma "Carteiras" frame draws it: the Wallet itself
// (nickname, Network, address, provider) plus the Buyer Details checkout prefills from. It uses
// the shared WalletInputSchema, so its messages are the same keys the API answers with.
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/app/api/errors'
import { WALLET_PROVIDERS, type Wallet, type WalletInput, WalletInputSchema } from '@/contracts/account'
import { NETWORKS } from '@/contracts/common'
import { EnsInput, withEthSuffix, withoutEthSuffix } from '@/features/account/ens-input'
import { applyFieldErrors, isSessionLoss } from '@/features/auth/form-errors'
import { SubmitButton } from '@/features/auth/submit-button'
import { useT } from '@/lib/i18n'
import { errorMessageKey } from '@/ui/feedback'
import { FormField } from '@/ui/form-field'
import { Button } from '@/ui/primitives/button'
import { Input } from '@/ui/primitives/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/select'
import { networkLabel, providerLabel } from './format'
import { useSaveWallet } from './queries'

/** The form edits ENS without ".eth" and the secondary address as text; both convert on save. */
const WalletFormSchema = z.object({
  label: z.string(),
  address: z.string(),
  network: z.string(),
  provider: z.string(),
  displayName: z.string(),
  profileName: z.string(),
  email: z.string(),
  referralCode: z.string(),
  ensName: z.string(),
  secondaryAddress: z.string(),
})
type WalletFormValues = z.infer<typeof WalletFormSchema>

const FIELDS = Object.keys(WalletFormSchema.shape) as (keyof WalletFormValues)[]
const BUYER_FIELDS = ['displayName', 'profileName', 'email', 'referralCode', 'ensName'] as const

const toInput = (values: WalletFormValues, isPrimary: boolean): unknown => ({
  ...values,
  isPrimary,
  ensName: withEthSuffix(values.ensName),
  secondaryAddress: values.secondaryAddress.trim() || null,
})

// Validate the converted values with the real contract; errors land on the form's own fields.
// An unselected Network/Provider reads "required", not zod's generic enum message.
const contract = zodResolver(WalletInputSchema, {
  error: (issue) => (issue.input === undefined || issue.input === '' ? 'validation.required' : undefined),
})

const toValues = (wallet: Wallet | undefined): WalletFormValues => ({
  label: wallet?.label ?? '',
  address: wallet?.address ?? '',
  network: wallet?.network ?? '',
  provider: wallet?.provider ?? '',
  displayName: wallet?.displayName ?? '',
  profileName: wallet?.profileName ?? '',
  email: wallet?.email ?? '',
  referralCode: wallet?.referralCode ?? '',
  ensName: withoutEthSuffix(wallet?.ensName),
  secondaryAddress: wallet?.secondaryAddress ?? '',
})

export function WalletForm({
  collectorId,
  wallet,
  primary,
  copyFrom,
  onSaved,
  onCancel,
}: {
  collectorId: string
  /** The Wallet being edited; omitted for a new one. */
  wallet?: Wallet
  /** Whether the Wallet is (or becomes) the Primary Wallet. */
  primary: boolean
  /** "Igual à carteira principal": copy that Wallet's Buyer Details into this form. */
  copyFrom?: Wallet
  onSaved?: (saved: Wallet) => void
  onCancel?: () => void
}) {
  const t = useT()
  const formId = useId()
  const save = useSaveWallet(collectorId)
  const form = useForm<WalletFormValues>({
    defaultValues: toValues(wallet),
    resolver: async (values, context, options) => {
      const result = await contract(toInput(values, primary) as WalletInput, context, options as never)
      return result.errors && Object.keys(result.errors).length > 0
        ? { values: {}, errors: result.errors as never }
        : { values, errors: {} }
    },
  })
  const { errors } = form.formState

  useEffect(() => {
    if (!copyFrom) return
    const source = toValues(copyFrom)
    for (const field of BUYER_FIELDS) form.setValue(field, source[field], { shouldDirty: true })
  }, [copyFrom, form])

  const onSubmit = form.handleSubmit(async (values) => {
    let saved: Wallet
    try {
      const input = WalletInputSchema.parse(toInput(values, primary))
      saved = await save.mutateAsync({ id: wallet?.id, input })
    } catch (error) {
      if (isSessionLoss(error)) return
      if (!applyFieldErrors(error, form.setError, FIELDS)) {
        form.setError('root', { message: isApiError(error) ? errorMessageKey(error) : 'error.unknown' })
      }
      return
    }
    toast.success(t('account.wallets.saved'))
    form.reset(toValues(saved))
    onSaved?.(saved)
  })

  const text = (name: keyof WalletFormValues, label: string, extra: object = {}) => (
    <FormField label={label} error={errors[name]?.message} required>
      <Input autoComplete="off" className="h-10 bg-transparent" {...form.register(name)} {...extra} />
    </FormField>
  )

  return (
    <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        {text('displayName', t('account.wallets.fieldDisplayName'), { autoComplete: 'name' })}
        {text('label', t('account.wallets.fieldLabel'))}

        <Controller
          control={form.control}
          name="network"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} name={field.name}>
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
        {text('profileName', t('account.wallets.fieldProfileName'))}

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
        {/* The Figma draws this field with a placeholder only; the label stays for assistive tech. */}
        <FormField
          label={t('account.wallets.fieldSecondaryAddress')}
          error={errors.secondaryAddress?.message}
          className="md:pt-[26px] [&>label]:sr-only"
        >
          <Input
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t('account.wallets.fieldSecondaryAddress')}
            className="h-10 bg-transparent"
            {...form.register('secondaryAddress')}
          />
        </FormField>

        <Controller
          control={form.control}
          name="provider"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} name={field.name}>
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
        {text('referralCode', t('account.wallets.fieldReferralCode'), { autoCapitalize: 'characters' })}

        {text('email', t('account.wallets.fieldEmail'), { type: 'email', autoComplete: 'email' })}
        <FormField label={t('account.wallets.fieldEns')} error={errors.ensName?.message} required>
          <EnsInput {...form.register('ensName')} />
        </FormField>
      </div>

      {errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {t(errors.root.message)}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={save.isPending} className="h-10 px-4 font-bold hover:bg-primary-hover">
          {t('account.wallets.save')}
        </SubmitButton>
        {onCancel && (
          <Button type="button" variant="outline" className="h-10" onClick={onCancel}>
            {t('account.wallets.cancel')}
          </Button>
        )}
      </div>
    </form>
  )
}
