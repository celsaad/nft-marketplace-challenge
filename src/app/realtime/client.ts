// Realtime client (module-design §8). One socket per Session; events go through the pure
// reconciler and its effects are applied to the query cache. Spike constraints (ADR 0001):
// socket.io-client is imported only now (after backendReady: the mocks started), websocket transport only,
// and the token travels in the URL query.
import type { Socket } from 'socket.io-client'
import { create } from 'zustand'
import type { CatalogPage, NftDetail } from '@/contracts/catalog'
import { REALTIME_EVENT_TYPES, RealtimeEventSchema } from '@/contracts/events'
import type { Cart } from '@/contracts/purchase'
import { announce } from '../announcer'
import { backendReady } from '../backend-ready'
import { config } from '../config'
import { queryClient } from '../query/client'
import { keys } from '../query/keys'
import { getSession } from '../session/store'
import { type Effect, reconcile, type Versions } from './reconcile'

export type RealtimeStatus = 'connecting' | 'online' | 'offline'
export const useRealtimeStatus = create<{ status: RealtimeStatus }>()(() => ({ status: 'connecting' }))

let socket: Socket | null = null
let versions: Versions = {}
/** Bumped on every (re)bind, so a late event from a previous Session's socket is ignored. */
let generation = 0

export async function connectRealtime() {
  const myGeneration = ++generation
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
  versions = {}
  useRealtimeStatus.setState({ status: 'connecting' })

  const { token, collectorId } = getSession()
  await backendReady
  const { io } = await import('socket.io-client')
  if (myGeneration !== generation) return

  const next = io(config.realtimeUrl, {
    transports: ['websocket'],
    query: token ? { token } : {},
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  })
  socket = next
  let connectedBefore = false

  next.on('connect', () => {
    useRealtimeStatus.setState({ status: 'online' })
    if (connectedBefore) {
      // Events may have been missed while offline: reconcile active data with REST (ADR 0002).
      void queryClient.invalidateQueries({ refetchType: 'active' })
      announce({ kind: 'realtime-online' })
    }
    connectedBefore = true
  })
  next.on('disconnect', () => {
    useRealtimeStatus.setState({ status: 'offline' })
    if (connectedBefore) announce({ kind: 'realtime-offline' })
  })
  for (const type of REALTIME_EVENT_TYPES) {
    next.on(type, (raw: unknown) => {
      if (myGeneration === generation) handleEvent(raw, collectorId)
    })
  }
}

export function disconnectRealtime() {
  generation++
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
}

function handleEvent(raw: unknown, boundCollectorId: string | null) {
  const parsed = RealtimeEventSchema.safeParse(raw)
  if (!parsed.success) return
  const collectorId = getSession().collectorId
  if (collectorId !== boundCollectorId) return

  const cart = queryClient.getQueryData<Cart>(keys.cart(collectorId))
  const result = reconcile(versions, parsed.data, {
    collectorId,
    cartNftIds: new Set(cart?.lines.map((l) => l.nftId)),
  })
  versions = result.versions
  for (const effect of result.effects) applyEffect(effect, collectorId)
}

function applyEffect(effect: Effect, collectorId: string | null) {
  switch (effect.kind) {
    case 'patch-nft': {
      const { resourceId, version, payload } = effect.event
      const fresh = {
        price: payload.price,
        previousPrice: payload.previousPrice,
        soldOut: payload.soldOut,
        version,
      }
      queryClient.setQueriesData<CatalogPage>({ queryKey: keys.catalogAll }, (page) =>
        page
          ? {
              ...page,
              items: page.items.map((item) =>
                item.id === resourceId && item.version < version ? { ...item, ...fresh } : item,
              ),
            }
          : page,
      )
      queryClient.setQueryData<NftDetail>(keys.nft(resourceId), (detail) =>
        detail && detail.version < version
          ? {
              ...detail,
              ...fresh,
              editions: detail.editions.map((edition) => ({
                ...edition,
                available: payload.editions.find((e) => e.id === edition.id)?.available ?? edition.available,
              })),
            }
          : detail,
      )
      return
    }
    case 'invalidate':
      if (effect.target === 'cart') {
        void queryClient.invalidateQueries({ queryKey: keys.cart(collectorId) })
        void queryClient.invalidateQueries({ queryKey: keys.quoteAll(collectorId) })
      } else if (collectorId) {
        void queryClient.invalidateQueries({ queryKey: keys.order(collectorId, effect.id) })
      }
      return
    case 'announce':
      announce(effect.announcement)
      return
  }
}
