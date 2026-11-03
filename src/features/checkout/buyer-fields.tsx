// "Perfil do colecionador": every field and asterisk of the Pagamento frame, wired to React Hook
// Form + BuyerDetailsSchema. Rede and Tipo de carteira choose the Wallet (not buyer fields).
import { Controller, type UseFormReturn } from 'react-hook-form'
import type { Wallet } from '@/contracts/account'
import { NETWORKS, type Network } from '@/contracts/common'
import type { BuyerDetails } from '@/contracts/purchase'
import { useT } from '@/lib/i18n'
import { FormField } from '@/ui/form-field'
import { cn } from '@/ui/lib/utils'
import { Checkbox } from '@/ui/primitives/checkbox'
import { Input } from '@/ui/primitives/input'
import { Label } from '@/ui/primitives/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/select'
import { Textarea } from '@/ui/primitives/textarea'

const field = 'h-10 rounded-none border-input bg-transparent text-sm dark:bg-transparent'
const trigger = 'h-10! w-full rounded-none border-input bg-transparent dark:bg-transparent'

export function BuyerFields({
  form,
  wallets,
  network,
  onNetworkChange,
  walletId,
  onWalletChange,
  walletError,
  useOtherWallet,
  onUseOtherWalletChange,
}: {
  form: UseFormReturn<BuyerDetails>
  wallets: readonly Wallet[]
  network: Network
  onNetworkChange: (network: Network) => void
  walletId: string | null
  onWalletChange: (wallet: Wallet) => void
  walletError: string | null
  useOtherWallet: boolean
  onUseOtherWalletChange: (checked: boolean) => void
}) {
  const t = useT()
  const {
    register,
    control,
    formState: { errors },
  } = form
  const onNetwork = wallets.filter((w) => w.network === network)
  const networkError =
    onNetwork.length === 0
      ? t('purchase.checkout.noWalletOnNetwork', { network: t(`purchase.network.${network}`) })
      : undefined

  return (
    <section aria-labelledby="buyer-title" className="flex flex-col gap-4">
      <h2 id="buyer-title" className="text-[17px] font-bold">
        {t('purchase.checkout.profile')}
      </h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        <FormField label={t('purchase.checkout.displayName')} required error={errors.displayName?.message}>
          <Input className={field} autoComplete="name" {...register('displayName')} />
        </FormField>
        <FormField label={t('purchase.checkout.username')} required error={errors.username?.message}>
          <Input className={field} autoComplete="username" {...register('username')} />
        </FormField>

        <Select value={network} onValueChange={(value) => onNetworkChange(value as Network)}>
          <FormField label={t('purchase.checkout.network')} required error={networkError}>
            <SelectTrigger className={trigger}>
              <SelectValue placeholder={t('purchase.checkout.networkPlaceholder')} />
            </SelectTrigger>
          </FormField>
          <SelectContent>
            {NETWORKS.map((n) => (
              <SelectItem key={n} value={n}>
                {t(`purchase.network.${n}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormField label={t('purchase.checkout.profileName')} required error={errors.profileName?.message}>
          <Input className={field} {...register('profileName')} />
        </FormField>

        <FormField
          label={t('purchase.checkout.walletAddress')}
          required
          error={errors.walletAddress?.message}
          description={t('purchase.checkout.walletAddressHint')}
        >
          <Input
            className={cn(field, 'text-muted-foreground')}
            readOnly
            placeholder={t('purchase.checkout.walletAddressPlaceholder')}
            {...register('walletAddress')}
          />
        </FormField>
        {useOtherWallet ? (
          <FormField label={t('purchase.checkout.secondaryWallet')} error={errors.secondaryWallet?.message}>
            <Input
              className={field}
              placeholder={t('purchase.checkout.secondaryWallet')}
              autoComplete="off"
              {...register('secondaryWallet')}
            />
          </FormField>
        ) : (
          <div aria-hidden className="hidden md:block" />
        )}

        <Select
          value={walletId ?? ''}
          onValueChange={(id) => {
            const wallet = wallets.find((w) => w.id === id)
            if (wallet) onWalletChange(wallet)
          }}
          disabled={onNetwork.length === 0}
        >
          <FormField label={t('purchase.checkout.walletType')} required error={walletError ?? undefined}>
            <SelectTrigger className={trigger}>
              <SelectValue placeholder={t('purchase.checkout.walletTypePlaceholder')} />
            </SelectTrigger>
          </FormField>
          <SelectContent>
            {onNetwork.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {t(`purchase.provider.${w.provider}`)} · {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormField label={t('purchase.checkout.referralCode')} required error={errors.referralCode?.message}>
          <Input className={field} autoComplete="off" {...register('referralCode')} />
        </FormField>

        <FormField label={t('purchase.checkout.email')} required error={errors.email?.message}>
          <Input className={field} type="email" autoComplete="email" {...register('email')} />
        </FormField>
        <Controller
          control={control}
          name="ensName"
          render={({ field: ens, fieldState }) => (
            <FormField label={t('purchase.checkout.ensName')} required error={fieldState.error?.message}>
              <EnsInput
                value={ens.value}
                onChange={ens.onChange}
                onBlur={ens.onBlur}
                inputRef={ens.ref}
                name={ens.name}
              />
            </FormField>
          )}
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Checkbox
          id="use-other-wallet"
          checked={useOtherWallet}
          onCheckedChange={(checked) => onUseOtherWalletChange(checked === true)}
          className="size-4 rounded-full border-primary"
        />
        <Label htmlFor="use-other-wallet" className="text-[15px] font-normal">
          {t('purchase.checkout.useOtherWallet')}
        </Label>
      </div>

      <FormField
        label={t('purchase.checkout.note')}
        error={errors.note?.message}
        className="md:max-w-[350px]"
      >
        <Textarea
          className="h-[150px] resize-none rounded-none border-input bg-transparent dark:bg-transparent"
          {...register('note')}
        />
      </FormField>
    </section>
  )
}

/** "Nome ENS": the name is typed, the ".eth" suffix is fixed (as drawn), the value is "name.eth". */
function EnsInput({
  value,
  onChange,
  onBlur,
  inputRef,
  name,
  ...aria
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  inputRef: (el: HTMLInputElement | null) => void
  name: string
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}) {
  const label = value.replace(/\.eth$/, '')
  return (
    <div className="flex h-10 w-full items-stretch border border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50">
      <input
        {...aria}
        ref={inputRef}
        name={name}
        value={label}
        onChange={(e) => {
          const typed = e.target.value
            .trim()
            .toLowerCase()
            .replace(/\.eth$/, '')
          onChange(typed ? `${typed}.eth` : '')
        }}
        onBlur={onBlur}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
      />
      <span aria-hidden className="grid place-items-center border-l border-input px-3 text-sm">
        .eth
      </span>
    </div>
  )
}
