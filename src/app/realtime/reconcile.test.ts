import { describe, expect, it } from 'vitest'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts/events'
import { eth } from '@/lib/money/eth'
import { reconcile } from './reconcile'

const nftEvent = (version: number, overrides: Partial<NftUpdatedEvent> = {}): NftUpdatedEvent => ({
  type: 'nft.updated',
  eventId: `evt_${version}`,
  resourceId: 'nft_emerald-ape-042',
  version,
  occurredAt: '2026-11-03T12:00:00.000Z',
  userId: null,
  payload: { price: eth('0.99'), previousPrice: eth('1.19'), editions: [], soldOut: false },
  ...overrides,
})

const guest = { collectorId: null, cartNftIds: new Set<string>() }
const ana = { collectorId: 'col_ana', cartNftIds: new Set<string>() }

const orderEvent = (userId: string, status: OrderUpdatedEvent['payload']['status']): OrderUpdatedEvent => ({
  type: 'order.updated',
  eventId: `evt_${userId}_${status}`,
  resourceId: 'ord_1',
  version: 2,
  occurredAt: '2026-11-03T12:00:02.500Z',
  userId,
  payload: { status },
})

describe('reconcile', () => {
  it('applies a newer NFT update and remembers its version', () => {
    const event = nftEvent(2)
    const { versions, effects } = reconcile({}, event, guest)
    expect(versions).toEqual({ 'nft.updated:nft_emerald-ape-042': 2 })
    expect(effects).toEqual([{ kind: 'patch-nft', event }])
  })

  it('ignores duplicates and stale events, never regressing newer state', () => {
    const seen = { 'nft.updated:nft_emerald-ape-042': 5 }
    for (const event of [nftEvent(5), nftEvent(3)]) {
      expect(reconcile(seen, event, guest)).toEqual({ versions: seen, effects: [] })
    }
  })

  it('ignores events meant for another Collector, and private events reaching a Guest', () => {
    const forBruno = orderEvent('col_bruno', 'confirmed')
    expect(reconcile({}, forBruno, ana)).toEqual({ versions: {}, effects: [] })
    expect(reconcile({}, forBruno, guest)).toEqual({ versions: {}, effects: [] })
  })

  it('re-quotes and announces a change to an NFT in the Cart', () => {
    const event = nftEvent(2)
    const inCart = { ...ana, cartNftIds: new Set(['nft_emerald-ape-042']) }
    expect(reconcile({}, event, inCart).effects).toEqual([
      { kind: 'patch-nft', event },
      { kind: 'invalidate', target: 'cart' },
      { kind: 'announce', announcement: { kind: 'cart-item-changed', nftId: 'nft_emerald-ape-042' } },
    ])
  })

  it('refreshes and announces an Order’s new status; confirmation also refreshes the Cart', () => {
    const confirmed = reconcile({}, orderEvent('col_ana', 'confirmed'), ana)
    expect(confirmed.effects).toEqual([
      { kind: 'invalidate', target: 'order', id: 'ord_1' },
      { kind: 'invalidate', target: 'cart' },
      { kind: 'announce', announcement: { kind: 'order-status', orderId: 'ord_1', status: 'confirmed' } },
    ])
    const rejected = reconcile({}, orderEvent('col_ana', 'rejected'), ana)
    expect(rejected.effects).toEqual([
      { kind: 'invalidate', target: 'order', id: 'ord_1' },
      { kind: 'announce', announcement: { kind: 'order-status', orderId: 'ord_1', status: 'rejected' } },
    ])
  })
})
