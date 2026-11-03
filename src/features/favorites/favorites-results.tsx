// The Favorites view (`/?favorites=true`, the mobile tab bar's heart): the signed-in Collector's
// Favorite NFTs, or an invitation to sign in for Guests.
import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useSessionStore } from '@/app/session/store'
import { gridClass, SkeletonGrid, staggerClass } from '@/features/catalog/catalog-results'
import { NftCard } from '@/features/catalog/nft-card'
import { nftQuery } from '@/features/nft/queries'
import { useT } from '@/lib/i18n'
import { EmptyState, ErrorState } from '@/ui/feedback'
import { cn } from '@/ui/lib/utils'
import { Button } from '@/ui/primitives/button'
import { useFavoriteIds } from './use-favorite'

export function FavoritesResults() {
  const t = useT()
  const collectorId = useSessionStore((s) => s.collectorId)
  const ids = useFavoriteIds()
  const nfts = useQueries({
    queries: (ids.data ?? []).map((id) => nftQuery(id)),
  })

  if (!collectorId) {
    return (
      <EmptyState title={t('catalog.favorites.guestTitle')}>
        <p className="text-sm text-muted-foreground">{t('catalog.favorites.guestBody')}</p>
        <Button asChild className="mt-2">
          <Link to="/entrar" search={{ redirect: '/?favorites=true' }}>
            {t('header.login')}
          </Link>
        </Button>
      </EmptyState>
    )
  }
  if (ids.isPending) return <SkeletonGrid count={4} />
  if (ids.isError) return <ErrorState error={ids.error} onRetry={() => void ids.refetch()} />
  if (ids.data.length === 0) {
    return (
      <EmptyState title={t('catalog.favorites.emptyTitle')}>
        <p className="text-sm text-muted-foreground">{t('catalog.favorites.emptyBody')}</p>
        <Button asChild variant="outline" className="mt-2">
          <Link to="/" hash="mercado">
            {t('catalog.favorites.browse')}
          </Link>
        </Button>
      </EmptyState>
    )
  }
  if (nfts.some((q) => q.isPending)) return <SkeletonGrid count={ids.data.length} />

  return (
    <ul className={cn(gridClass, 'max-md:pb-8')}>
      {nfts.map((q, i) =>
        q.data ? (
          <li key={q.data.id} className={staggerClass(i)}>
            <NftCard nft={q.data} />
          </li>
        ) : null,
      )}
    </ul>
  )
}
