// Wallets (/carteiras), following the Figma's two blocks: "Carteira principal" and "Carteira
// secundária", each with its "Adicionar". Wallets are listed as cards; create and edit happen in
// a dialog. Marking a Wallet as Primary moves it (and its badge) to the first block.
import { useState } from 'react'
import { toast } from 'sonner'
import { useSessionStore } from '@/app/session/store'
import type { Wallet } from '@/contracts/account'
import { AccountLayout } from '@/features/account/account-layout'
import { isSessionLoss } from '@/features/auth/form-errors'
import { useT } from '@/lib/i18n'
import { ErrorState, errorMessageKey, LoadingRegion, RefreshingHint, Skeleton } from '@/ui/feedback'
import { Badge } from '@/ui/primitives/badge'
import { Button } from '@/ui/primitives/button'
import { networkLabel, providerLabel, shortAddress } from './format'
import { useSaveWallet, useWallets } from './queries'
import { WalletDialog, type WalletDialogTarget } from './wallet-dialog'

const editId = (wallet: Wallet) => `wallet-edit-${wallet.id}`

export function WalletsPage() {
  const t = useT()
  const collectorId = useSessionStore((s) => s.collectorId) ?? ''
  const query = useWallets(collectorId)
  const [target, setTarget] = useState<WalletDialogTarget | null>(null)
  const [open, setOpen] = useState(false)

  const openDialog = (next: WalletDialogTarget) => {
    setTarget(next)
    setOpen(true)
  }

  const wallets = query.data ?? []
  const primary = wallets.find((w) => w.isPrimary)
  const secondary = wallets.filter((w) => !w.isPrimary)

  return (
    <AccountLayout>
      <h1 className="sr-only">{t('account.wallets.title')}</h1>
      {query.isPending ? (
        <LoadingRegion className="flex flex-col gap-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </LoadingRegion>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <section aria-labelledby="wallets-primary">
            <SectionHeader
              id="wallets-primary"
              title={t('account.wallets.primaryTitle')}
              addId="wallet-add-primary"
              addLabel={t('account.wallets.addPrimary')}
              onAdd={() => openDialog({ primary: true, returnFocusTo: 'wallet-add-primary' })}
            >
              <p className="mt-1 text-xs tracking-wide text-muted-foreground">
                {t('account.wallets.description')}
              </p>
            </SectionHeader>
            <div className="mt-6 grid lg:grid-cols-2">
              {primary ? (
                <WalletCard
                  wallet={primary}
                  collectorId={collectorId}
                  onEdit={() =>
                    openDialog({ wallet: primary, primary: true, returnFocusTo: editId(primary) })
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t('account.wallets.noPrimary')}</p>
              )}
            </div>
          </section>

          <section aria-labelledby="wallets-secondary" className="mt-12">
            <SectionHeader
              id="wallets-secondary"
              title={t('account.wallets.secondaryTitle')}
              addId="wallet-add-secondary"
              addLabel={t('account.wallets.addSecondary')}
              onAdd={() => openDialog({ primary: false, returnFocusTo: 'wallet-add-secondary' })}
            />
            {secondary.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('account.wallets.noSecondary')}</p>
            ) : (
              <ul className="mt-6 grid gap-4 lg:grid-cols-2">
                {secondary.map((wallet) => (
                  <li key={wallet.id}>
                    <WalletCard
                      wallet={wallet}
                      collectorId={collectorId}
                      onEdit={() => openDialog({ wallet, primary: false, returnFocusTo: editId(wallet) })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="mt-4">
            <RefreshingHint active={query.isFetching} />
          </div>
        </>
      )}

      <WalletDialog collectorId={collectorId} target={target} open={open} onOpenChange={setOpen} />
    </AccountLayout>
  )
}

function SectionHeader({
  id,
  title,
  addId,
  addLabel,
  onAdd,
  children,
}: {
  id: string
  title: string
  addId: string
  addLabel: string
  onAdd: () => void
  children?: React.ReactNode
}) {
  const t = useT()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-bold">
          {title}
        </h2>
        {children}
      </div>
      <button
        id={addId}
        type="button"
        onClick={onAdd}
        aria-label={addLabel}
        className="shrink-0 rounded-sm text-base font-bold text-primary hover:text-primary-hover"
      >
        {t('account.wallets.add')}
      </button>
    </div>
  )
}

function WalletCard({
  wallet,
  collectorId,
  onEdit,
}: {
  wallet: Wallet
  collectorId: string
  onEdit: () => void
}) {
  const t = useT()
  const save = useSaveWallet(collectorId)

  // mutateAsync, not mutate(…, callbacks): this card unmounts when it moves to the Primary block,
  // and per-call callbacks of an unmounted observer never run.
  const makePrimary = async () => {
    const { id, createdAt: _, ...input } = wallet
    try {
      await save.mutateAsync({ id, input: { ...input, isPrimary: true } })
    } catch (error) {
      if (!isSessionLoss(error)) toast.error(t(errorMessageKey(error)))
      return
    }
    toast.success(t('account.wallets.primaryChanged', { label: wallet.label }))
    // Keep keyboard focus on the Wallet in its new place.
    requestAnimationFrame(() => document.getElementById(editId(wallet))?.focus())
  }

  return (
    <article
      aria-labelledby={`wallet-${wallet.id}-label`}
      data-testid="wallet-card"
      className="flex h-full flex-col gap-4 rounded-sm border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`wallet-${wallet.id}-label`} className="min-w-0 truncate font-bold">
          {wallet.label}
        </h3>
        {wallet.isPrimary && (
          <Badge className="rounded-sm font-bold">{t('account.wallets.primaryBadge')}</Badge>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t('account.wallets.network')}</dt>
        <dd>{t(networkLabel(wallet.network))}</dd>
        <dt className="text-muted-foreground">{t('account.wallets.provider')}</dt>
        <dd>{t(providerLabel(wallet.provider))}</dd>
        <dt className="text-muted-foreground">{t('account.wallets.address')}</dt>
        <dd title={wallet.address} className="truncate">
          {shortAddress(wallet.address)}
        </dd>
      </dl>
      <div className="mt-auto flex flex-wrap gap-3">
        <Button
          id={editId(wallet)}
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          aria-label={t('account.wallets.editLabel', { label: wallet.label })}
          className="border-primary text-primary"
        >
          {t('account.wallets.edit')}
        </Button>
        {!wallet.isPrimary && (
          <Button
            type="button"
            size="sm"
            onClick={() => void makePrimary()}
            disabled={save.isPending}
            aria-busy={save.isPending || undefined}
            aria-label={t('account.wallets.makePrimaryLabel', { label: wallet.label })}
            className="font-bold hover:bg-primary-hover"
          >
            {t('account.wallets.makePrimary')}
          </Button>
        )}
      </div>
    </article>
  )
}
