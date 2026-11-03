// Wallets (/carteiras), as the Figma draws it: "Carteira principal" edited inline, then "Carteira
// secundária" with "Igual à carteira principal" (copies the Buyer Details) and "Adicionar".
// Every Wallet carries the Buyer Details checkout prefills from (GLOSSARY: Buyer Details).
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
import { Checkbox } from '@/ui/primitives/checkbox'
import { Label } from '@/ui/primitives/label'
import { networkLabel, providerLabel, shortAddress } from './format'
import { useSaveWallet, useWallets } from './queries'
import { WalletForm } from './wallet-form'

export function WalletsPage() {
  const t = useT()
  const collectorId = useSessionStore((s) => s.collectorId) ?? ''
  const query = useWallets(collectorId)
  const [addingPrimary, setAddingPrimary] = useState(false)
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  const wallets = query.data ?? []
  const primary = wallets.find((w) => w.isPrimary)
  const secondary = wallets.filter((w) => !w.isPrimary)
  const copyFrom = sameAsPrimary ? primary : undefined

  return (
    <AccountLayout>
      <h1 className="sr-only">{t('account.wallets.title')}</h1>
      {query.isPending ? (
        <LoadingRegion className="flex flex-col gap-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-64" />
          <Skeleton className="h-16" />
        </LoadingRegion>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <section aria-labelledby="wallets-primary">
            <SectionHeader
              id="wallets-primary"
              title={t(addingPrimary ? 'account.wallets.newPrimaryTitle' : 'account.wallets.primaryTitle')}
              addId="wallet-add-primary"
              addLabel={t('account.wallets.addPrimary')}
              onAdd={() => setAddingPrimary(true)}
            >
              <p className="mt-1 text-xs tracking-wide text-muted-foreground">
                {t('account.wallets.description')}
              </p>
            </SectionHeader>
            <div className="mt-6">
              {addingPrimary || !primary ? (
                <>
                  {!primary && (
                    <p className="mb-6 text-sm text-muted-foreground">{t('account.wallets.noPrimary')}</p>
                  )}
                  <WalletForm
                    key="new-primary"
                    collectorId={collectorId}
                    primary
                    onSaved={() => setAddingPrimary(false)}
                    onCancel={primary ? () => setAddingPrimary(false) : undefined}
                  />
                </>
              ) : (
                <WalletForm key={primary.id} collectorId={collectorId} wallet={primary} primary />
              )}
            </div>
          </section>

          <section aria-labelledby="wallets-secondary" className="mt-12">
            <SectionHeader
              id="wallets-secondary"
              title={t('account.wallets.secondaryTitle')}
              addId="wallet-add-secondary"
              addLabel={t('account.wallets.addSecondary')}
              onAdd={() => setAddingSecondary(true)}
              extra={
                primary && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="wallet-same-as-primary"
                      checked={sameAsPrimary}
                      onCheckedChange={(checked) => setSameAsPrimary(checked === true)}
                      aria-describedby="wallet-same-as-primary-hint"
                      className="rounded-full"
                    />
                    <Label htmlFor="wallet-same-as-primary" className="font-normal">
                      {t('account.wallets.sameAsPrimary')}
                    </Label>
                    <span id="wallet-same-as-primary-hint" className="sr-only">
                      {t('account.wallets.sameAsPrimaryHint')}
                    </span>
                  </div>
                )
              }
            />

            {addingSecondary && (
              <div className="mt-6 rounded-sm border border-border p-4">
                <h3 className="mb-4 text-sm font-bold">{t('account.wallets.newSecondaryTitle')}</h3>
                <WalletForm
                  collectorId={collectorId}
                  primary={false}
                  copyFrom={copyFrom}
                  onSaved={() => setAddingSecondary(false)}
                  onCancel={() => setAddingSecondary(false)}
                />
              </div>
            )}

            {secondary.length === 0 && !addingSecondary ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('account.wallets.noSecondary')}</p>
            ) : (
              <ul className="mt-6 flex flex-col gap-4">
                {secondary.map((wallet) => (
                  <li key={wallet.id}>
                    <SecondaryWallet
                      wallet={wallet}
                      collectorId={collectorId}
                      editing={editingId === wallet.id}
                      copyFrom={editingId === wallet.id ? copyFrom : undefined}
                      onToggle={() => setEditingId(editingId === wallet.id ? null : wallet.id)}
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
    </AccountLayout>
  )
}

function SectionHeader({
  id,
  title,
  addId,
  addLabel,
  onAdd,
  extra,
  children,
}: {
  id: string
  title: string
  addId: string
  addLabel: string
  onAdd: () => void
  extra?: React.ReactNode
  children?: React.ReactNode
}) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-bold">
          {title}
        </h2>
        {children}
      </div>
      <div className="flex items-center gap-4">
        {extra}
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
    </div>
  )
}

const editId = (wallet: Wallet) => `wallet-edit-${wallet.id}`

/** A secondary Wallet: a summary row that opens into the same inline form. */
function SecondaryWallet({
  wallet,
  collectorId,
  editing,
  copyFrom,
  onToggle,
}: {
  wallet: Wallet
  collectorId: string
  editing: boolean
  copyFrom?: Wallet
  onToggle: () => void
}) {
  const t = useT()
  const save = useSaveWallet(collectorId)

  // mutateAsync, not mutate(…, callbacks): this row unmounts when it moves to the Primary block,
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
    requestAnimationFrame(() =>
      document.getElementById('wallets-primary')?.scrollIntoView({ block: 'start' }),
    )
  }

  return (
    <article
      aria-labelledby={`wallet-${wallet.id}-label`}
      data-testid="wallet-card"
      className="flex flex-col gap-4 rounded-sm border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <h3 id={`wallet-${wallet.id}-label`} className="truncate font-bold">
            {wallet.label}
          </h3>
          <span className="text-muted-foreground">{t(networkLabel(wallet.network))}</span>
          <span className="text-muted-foreground">{t(providerLabel(wallet.provider))}</span>
          <span title={wallet.address} className="font-mono text-muted-foreground">
            {shortAddress(wallet.address)}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            id={editId(wallet)}
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggle}
            aria-expanded={editing}
            aria-label={t(editing ? 'account.wallets.collapse' : 'account.wallets.editLabel', {
              label: wallet.label,
            })}
            className="border-primary text-primary"
          >
            {t(editing ? 'account.wallets.collapse' : 'account.wallets.edit')}
          </Button>
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
        </div>
      </div>
      {editing && (
        <WalletForm
          collectorId={collectorId}
          wallet={wallet}
          primary={false}
          copyFrom={copyFrom}
          onSaved={onToggle}
          onCancel={onToggle}
        />
      )}
      {!editing && wallet.isPrimary && <Badge>{t('account.wallets.primaryBadge')}</Badge>}
    </article>
  )
}
