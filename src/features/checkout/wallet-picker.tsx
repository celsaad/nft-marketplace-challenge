// "Carteira e rede": the Collector's registered Wallets as radio cards (mobile Pagamento frame),
// plus the simulated Wallet Connection for the chosen one (connect, rejected + retry, disconnect).
import { Link } from '@tanstack/react-router'
import { CheckCircle2Icon, Loader2Icon, PlugIcon, UnplugIcon } from 'lucide-react'
import type { Wallet } from '@/contracts/account'
import { shortAddress } from '@/lib/address'
import { useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { Button } from '@/ui/primitives/button'
import { RadioGroup, RadioGroupItem } from '@/ui/primitives/radio-group'
import type { ConnectionStatus } from './wallets'

export function WalletPicker({
  wallets,
  walletId,
  onSelect,
  status,
  onConnect,
  onDisconnect,
  disconnecting,
  error,
}: {
  wallets: readonly Wallet[]
  walletId: string | null
  onSelect: (wallet: Wallet) => void
  status: ConnectionStatus
  onConnect: () => void
  onDisconnect: () => void
  disconnecting: boolean
  /** An i18n key, e.g. "select a wallet" after a submit without one. */
  error: string | null
}) {
  const t = useT()
  const selected = wallets.find((w) => w.id === walletId) ?? null
  const errorId = 'wallet-picker-error'

  return (
    <section aria-labelledby="wallet-picker-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="wallet-picker-title" className="text-lg font-bold md:mx-auto md:text-base">
          {t('purchase.checkout.walletAndNetwork')}
        </h2>
        <Link to="/carteiras" className="text-sm font-bold text-primary hover:text-primary-hover md:hidden">
          {t('purchase.checkout.manageWallets')}
        </Link>
      </div>

      {wallets.length === 0 ? (
        <p className="text-sm text-destructive">
          {t('purchase.checkout.noWallets')}{' '}
          <Link to="/carteiras" className="font-bold text-primary underline">
            {t('purchase.checkout.manageWallets')}
          </Link>
        </p>
      ) : (
        <RadioGroup
          value={walletId ?? ''}
          onValueChange={(id) => {
            const wallet = wallets.find((w) => w.id === id)
            if (wallet) onSelect(wallet)
          }}
          aria-labelledby="wallet-picker-title"
          aria-describedby={error ? errorId : undefined}
          className="gap-3"
        >
          {wallets.map((wallet) => (
            <label
              key={wallet.id}
              htmlFor={`wallet-${wallet.id}`}
              className={cn(
                'flex cursor-pointer items-center gap-5 rounded-2xl border border-transparent bg-card px-6 py-4 transition-colors hover:border-primary/50 md:rounded-none md:border-border md:bg-transparent md:px-3 md:py-3',
                wallet.id === walletId && 'border-primary/70 md:border-foreground',
              )}
            >
              <RadioGroupItem
                id={`wallet-${wallet.id}`}
                value={wallet.id}
                className="size-5 border-primary"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-bold md:font-normal">
                  {t(`purchase.provider.${wallet.provider}`)} · {wallet.label}
                  {wallet.isPrimary && (
                    <span className="ml-2 rounded-sm bg-band px-1.5 text-[10px] font-bold text-primary uppercase">
                      {t('purchase.checkout.primary')}
                    </span>
                  )}
                </span>
                <span className="truncate text-sm text-muted-foreground">{shortAddress(wallet.address)}</span>
                <span className="text-sm text-muted-foreground">
                  {t('purchase.checkout.walletNetwork', { network: t(`purchase.network.${wallet.network}`) })}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      )}

      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {t(error)}
        </p>
      )}

      {selected && (
        <div className="flex flex-col gap-2" data-testid="wallet-connection">
          <output aria-live="polite" className="block text-sm">
            {status === 'approved' && (
              <span className="flex items-center gap-2 text-success">
                <CheckCircle2Icon aria-hidden className="size-4" />
                {t('purchase.checkout.connectedTo', { label: selected.label })}
              </span>
            )}
            {status === 'rejected' && (
              <span className="text-destructive">{t('purchase.checkout.walletRejected')}</span>
            )}
            {status === 'error' && (
              <span className="text-destructive">{t('purchase.checkout.walletError')}</span>
            )}
          </output>
          {status === 'approved' ? (
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={onDisconnect}
              disabled={disconnecting}
            >
              <UnplugIcon aria-hidden />
              {t('purchase.checkout.disconnect')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="self-start border-primary text-primary"
              onClick={onConnect}
              disabled={status === 'connecting'}
            >
              {status === 'connecting' ? (
                <Loader2Icon aria-hidden className="animate-spin motion-reduce:animate-none" />
              ) : (
                <PlugIcon aria-hidden />
              )}
              {status === 'connecting' ? t('purchase.checkout.connecting') : t('purchase.checkout.connect')}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
