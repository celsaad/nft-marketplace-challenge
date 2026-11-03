import { describe, expect, it } from 'vitest'
import { ANA, fakeClock, memoryStore, ok, sequentialIds } from './testing'
import { createWorld } from './world'

const EMERALD = { nftId: 'nft_emerald-ape-042', editionId: 'ed_emerald-ape-042_10' }

/** A "page load": a fresh World over whatever storage the previous one left behind. */
const boot = (storage = memoryStore(), clock = fakeClock(), options = {}) =>
  createWorld({ storage, clock, ids: sequentialIds() }, options)

async function placeOrder(world: Awaited<ReturnType<typeof boot>>) {
  const { token } = ok(await world.exec('auth.login', ANA, {}))
  ok(await world.exec('cart.addLine', { ...EMERALD, quantity: 1 }, { token }))
  ok(await world.exec('wallets.connect', { id: 'w_ana_main' }, { token }))
  const quote = ok(await world.exec('quote.create', { paymentNetwork: 'ethereum' }, { token }))
  const order = ok(
    await world.exec(
      'orders.create',
      {
        quoteId: quote.id,
        quoteHash: quote.hash,
        walletId: 'w_ana_main',
        paymentNetwork: 'ethereum',
        buyer: {
          displayName: 'Ana Souza',
          username: 'ana_souza',
          profileName: 'Ana',
          email: 'ana@jungle.test',
          walletAddress: `0x${'a11ce'.padEnd(40, '0')}`,
          referralCode: 'KURIO',
          ensName: 'anasouza.eth',
        },
      },
      { token, idempotencyKey: 'attempt-1' },
    ),
  )
  return { token, order }
}

describe('Persistence and Scenarios', () => {
  it('survives a reload: Sessions, Carts and Orders are still there', async () => {
    const storage = memoryStore()
    const first = await boot(storage)
    const { token, order } = await placeOrder(first)

    const reloaded = await boot(storage)
    expect(ok(await reloaded.exec('orders.get', { id: order.id }, { token })).status).toBe('pending')
    expect(ok(await reloaded.exec('cart.get', undefined, { token })).itemCount).toBe(1)
  })

  it('resumes a payment that was pending at reload, without creating another Order', async () => {
    const storage = memoryStore()
    const { token, order } = await placeOrder(await boot(storage))

    const clock = fakeClock()
    const reloaded = await boot(storage, clock)
    clock.advance(2500)
    expect(ok(await reloaded.exec('orders.get', { id: order.id }, { token })).status).toBe('confirmed')
  })

  it('resets to the Scenario’s known state', async () => {
    const storage = memoryStore()
    const world = await boot(storage)
    const { token } = await placeOrder(world)
    world.control.changePrice(EMERALD.nftId, '9.99')

    world.control.reset()
    expect(await world.exec('cart.get', undefined, { token })).toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    })
    expect(ok(await world.exec('catalog.get', { id: EMERALD.nftId }, {})).price).toBe('1.19')

    const reloaded = await boot(storage)
    expect(ok(await reloaded.exec('catalog.get', { id: EMERALD.nftId }, {})).price).toBe('1.19')
  })

  it('lets the Mock Lab inspect NFTs and the Orders still pending', async () => {
    const clock = fakeClock()
    const world = await boot(memoryStore(), clock)
    const { order } = await placeOrder(world)

    const view = world.control.inspect()
    expect(view.pendingOrders.map((o) => o.id)).toEqual([order.id])
    expect(view.nfts.find((n) => n.id === EMERALD.nftId)?.editions.map((e) => e.id)).toContain(
      EMERALD.editionId,
    )

    clock.advance(2500)
    expect(world.control.inspect().pendingOrders).toEqual([])
  })

  it('keeps each Scenario deterministic and stored apart from the others', async () => {
    const storage = memoryStore()
    const empty = await boot(storage, fakeClock(), { scenario: 'empty-catalog' })
    expect(ok(await empty.exec('catalog.list', {}, {})).total).toBe(0)

    const clock = fakeClock()
    const rejecting = await boot(storage, clock, { scenario: 'payment-rejected' })
    const { token, order } = await placeOrder(rejecting)
    clock.advance(2500)
    expect(ok(await rejecting.exec('orders.get', { id: order.id }, { token })).status).toBe('rejected')

    const normal = await boot(storage)
    expect(ok(await normal.exec('catalog.list', {}, {})).total).toBe(48)
    expect(normal.scenario.name).toBe('default')
  })
})
