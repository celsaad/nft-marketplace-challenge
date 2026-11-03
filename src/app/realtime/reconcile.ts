// Decides what a realtime event means for the client (ADR 0002). Pure: returns the new version
// map plus effects as data; the realtime client applies them to the query cache.
import type { NftUpdatedEvent, RealtimeEvent } from '@/contracts/events'
import type { OrderStatus } from '@/contracts/purchase'

/** Last applied version per `${type}:${resourceId}`. */
export type Versions = Readonly<Record<string, number>>

/** What the UI should tell the Collector (via the aria-live Announcer). */
export type Announcement =
  | { kind: 'cart-item-changed'; nftId: string }
  | { kind: 'order-status'; orderId: string; status: OrderStatus }

export type Effect =
  | { kind: 'patch-nft'; event: NftUpdatedEvent }
  | { kind: 'invalidate'; target: 'cart' }
  | { kind: 'invalidate'; target: 'order'; id: string }
  | { kind: 'announce'; announcement: Announcement }

export interface ReconcileContext {
  collectorId: string | null
  /** NFTs currently in the Cart: changes to them must be announced and re-quoted. */
  cartNftIds: ReadonlySet<string>
}

export function reconcile(
  versions: Versions,
  event: RealtimeEvent,
  context: ReconcileContext,
): { versions: Versions; effects: Effect[] } {
  // A private event only ever applies to the Collector it was addressed to.
  if (event.userId !== null && event.userId !== context.collectorId) return { versions, effects: [] }
  const key = `${event.type}:${event.resourceId}`
  // Duplicates and stale events change nothing (ADR 0002).
  if (event.version <= (versions[key] ?? 0)) return { versions, effects: [] }
  return { versions: { ...versions, [key]: event.version }, effects: effectsOf(event, context) }
}

function effectsOf(event: RealtimeEvent, context: ReconcileContext): Effect[] {
  if (event.type === 'nft.updated') {
    if (!context.cartNftIds.has(event.resourceId)) return [{ kind: 'patch-nft', event }]
    return [
      { kind: 'patch-nft', event },
      { kind: 'invalidate', target: 'cart' },
      { kind: 'announce', announcement: { kind: 'cart-item-changed', nftId: event.resourceId } },
    ]
  }
  const { status } = event.payload
  return [
    { kind: 'invalidate', target: 'order', id: event.resourceId },
    ...(status === 'confirmed' ? [{ kind: 'invalidate', target: 'cart' } as const] : []),
    { kind: 'announce', announcement: { kind: 'order-status', orderId: event.resourceId, status } },
  ]
}
