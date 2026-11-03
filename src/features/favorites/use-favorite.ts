// Favorites (module-design §10): the challenge's required optimistic update. The heart flips at
// once; requests are serialized per NFT (last intent wins, see sync.ts) and a failure rolls the
// cache back to what the server last confirmed, with an accessible toast saying why.
import { queryOptions, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { create } from 'zustand'
import { api } from '@/app/api/endpoints'
import { queryClient } from '@/app/query/client'
import { keys } from '@/app/query/keys'
import { getSession, useSessionStore } from '@/app/session/store'
import { t } from '@/lib/i18n'
import { errorMessageKey } from '@/ui/feedback'
import { createFavoriteSync, type FavoriteSync } from './sync'

export const favoritesQuery = (collectorId: string) =>
  queryOptions({
    queryKey: keys.favorites(collectorId),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
  })

/** Which NFTs have a Favorite request in flight (per Collector), for `pending`. */
const usePending = create<{ pending: ReadonlySet<string> }>()(() => ({ pending: new Set() }))

/** Opens the "sign in to favorite" dialog (rendered by <FavoriteSignInDialog>). */
export const useSignInPrompt = create<{ open: boolean }>()(() => ({ open: false }))

const pendingKey = (collectorId: string, nftId: string) => `${collectorId}:${nftId}`

/** Writes one NFT's membership into the cached list, leaving every other NFT as it is. */
function setMembership(collectorId: string, nftId: string, favorite: boolean) {
  // A late answer for a Collector who has since logged out must not recreate their cache.
  if (getSession().collectorId !== collectorId) return
  queryClient.setQueryData<string[]>(keys.favorites(collectorId), (list = []) => {
    const without = list.filter((id) => id !== nftId)
    return favorite ? [nftId, ...without] : without
  })
}

const syncs = new Map<string, FavoriteSync>()

function syncFor(collectorId: string): FavoriteSync {
  let sync = syncs.get(collectorId)
  if (!sync) {
    sync = createFavoriteSync({
      send: async (nftId, favorite) => {
        await (favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId))
      },
      onSettled: (nftId, favorite) => {
        setMembership(collectorId, nftId, favorite)
        toast.success(t(favorite ? 'catalog.favorite.added' : 'catalog.favorite.removed'), {
          id: `favorite-${nftId}`,
        })
      },
      onFailure: (nftId, error, rollbackTo) => {
        setMembership(collectorId, nftId, rollbackTo)
        toast.error(t('catalog.favorite.failed'), {
          id: `favorite-${nftId}`,
          description: t(errorMessageKey(error)),
        })
      },
      onPendingChange: (nftId, pending) =>
        usePending.setState((s) => {
          const next = new Set(s.pending)
          if (pending) next.add(pendingKey(collectorId, nftId))
          else next.delete(pendingKey(collectorId, nftId))
          return { pending: next }
        }),
    })
    syncs.set(collectorId, sync)
  }
  return sync
}

/** The signed-in Collector's Favorite NFT ids (empty for Guests). */
export function useFavoriteIds() {
  const collectorId = useSessionStore((s) => s.collectorId)
  return useQuery({ ...favoritesQuery(collectorId ?? ''), enabled: Boolean(collectorId) })
}

export function useFavorite(nftId: string) {
  const collectorId = useSessionStore((s) => s.collectorId)
  const { data } = useFavoriteIds()
  const isFavorite = Boolean(collectorId && data?.includes(nftId))
  const pending = usePending((s) => Boolean(collectorId && s.pending.has(pendingKey(collectorId, nftId))))

  const toggle = () => {
    if (!collectorId) {
      useSignInPrompt.setState({ open: true })
      return
    }
    const next = !isFavorite
    // A refetch landing now would overwrite the optimistic state with an older answer.
    void queryClient.cancelQueries({ queryKey: keys.favorites(collectorId) })
    setMembership(collectorId, nftId, next)
    syncFor(collectorId).set(nftId, next, isFavorite)
  }

  return { isFavorite, toggle, pending }
}
