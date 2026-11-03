import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, ok, testWorld } from './testing'

async function loggedIn() {
  const t = await testWorld()
  const ana = ok(await t.world.exec('auth.login', ANA, {}))
  const bruno = ok(await t.world.exec('auth.login', BRUNO, {}))
  return { ...t, ana: { token: ana.token }, bruno: { token: bruno.token } }
}

const EMERALD = { nftId: 'nft_emerald-ape-042', editionId: 'ed_emerald-ape-042_10' }
const GOLDEN = { nftId: 'nft_golden-beat-207', editionId: 'ed_golden-beat-207_open' }

describe('Cart', () => {
  it('merges a Guest Cart into the Collector’s Cart on login, capped by Availability', async () => {
    const { world } = await testWorld()
    world.control.setAvailability(EMERALD.editionId, 3)

    const ana = ok(await world.exec('auth.login', ANA, {}))
    ok(await world.exec('cart.addLine', { ...EMERALD, quantity: 1 }, { token: ana.token }))
    ok(await world.exec('auth.logout', undefined, { token: ana.token }))

    const guestCart = ok(await world.exec('cart.addLine', { ...EMERALD, quantity: 3 }, {}))
    ok(await world.exec('cart.addLine', { ...GOLDEN, quantity: 2 }, { cartId: guestCart.id }))

    const again = ok(await world.exec('auth.login', ANA, { cartId: guestCart.id }))
    const merged = ok(await world.exec('cart.get', undefined, { token: again.token }))
    expect(merged.lines.map((l) => [l.editionId, l.quantity])).toEqual([
      [EMERALD.editionId, 3],
      [GOLDEN.editionId, 2],
    ])
    expect(await world.exec('cart.get', undefined, { cartId: guestCart.id })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    })

    const bruno = ok(await world.exec('auth.login', BRUNO, {}))
    expect(ok(await world.exec('cart.get', undefined, { token: bruno.token })).lines).toEqual([])
  })

  it('refuses quantities beyond Availability or the per-order limit', async () => {
    const { world } = await testWorld()
    world.control.setAvailability(EMERALD.editionId, 2)
    expect(await world.exec('cart.addLine', { ...EMERALD, quantity: 3 }, {})).toMatchObject({
      error: { code: 'AVAILABILITY_CONFLICT' },
    })
    expect(await world.exec('cart.addLine', { ...GOLDEN, quantity: 11 }, {})).toMatchObject({
      error: { code: 'QUANTITY_LIMIT' },
    })
  })
})

describe('Quote', () => {
  async function anaWithCart() {
    const t = await loggedIn()
    ok(await t.world.exec('cart.addLine', { ...EMERALD, quantity: 2 }, t.ana))
    const cart = ok(await t.world.exec('cart.addLine', { ...GOLDEN, quantity: 1 }, t.ana))
    return { ...t, cart }
  }

  it('totals subtotal, percentage Coupon and the Payment Network’s fee', async () => {
    const { world, ana } = await anaWithCart()
    ok(await world.exec('cart.applyCoupon', { code: 'KURIO10' }, ana))

    const onEthereum = ok(await world.exec('quote.create', { paymentNetwork: 'ethereum' }, ana))
    expect(onEthereum).toMatchObject({
      subtotal: '3.37',
      discount: '0.337',
      networkFee: '0.016',
      total: '3.049',
      coupon: { code: 'KURIO10', status: 'applied' },
      issues: [],
    })
    const onPolygon = ok(await world.exec('quote.create', { paymentNetwork: 'polygon' }, ana))
    expect(onPolygon.total).toBe('3.035')
    expect(onPolygon.hash).not.toBe(onEthereum.hash)
  })

  it('refuses unknown and expired Coupons', async () => {
    const { world, ana } = await anaWithCart()
    expect(await world.exec('cart.applyCoupon', { code: 'NOPE' }, ana)).toMatchObject({
      error: { code: 'COUPON_INVALID' },
    })
    expect(await world.exec('cart.applyCoupon', { code: 'EXPIRED20' }, ana)).toMatchObject({
      error: { code: 'COUPON_EXPIRED' },
    })
  })

  it('drops a Coupon whose minimum is no longer met, and says why', async () => {
    const { world, ana, cart } = await anaWithCart()
    ok(await world.exec('cart.applyCoupon', { code: 'LAUNCH05' }, ana))
    const emeraldLine = cart.lines.find((l) => l.editionId === EMERALD.editionId)
    ok(await world.exec('cart.removeLine', { lineId: emeraldLine?.id ?? '' }, ana))

    const quote = ok(await world.exec('quote.create', { paymentNetwork: 'ethereum' }, ana))
    expect(quote).toMatchObject({
      subtotal: '0.99',
      discount: '0',
      total: '1.006',
      coupon: null,
      issues: [{ kind: 'coupon-dropped', code: 'LAUNCH05', reason: 'minimum-not-met' }],
    })
    expect(ok(await world.exec('cart.get', undefined, ana)).couponCode).toBeNull()
  })
})

describe('Collector isolation', () => {
  it('keeps Favorites per Collector and refuses Guests', async () => {
    const { world, ana, bruno } = await loggedIn()
    expect(ok(await world.exec('favorites.add', { nftId: 'nft_emerald-ape-042' }, ana))).toEqual([
      'nft_emerald-ape-042',
    ])
    expect(ok(await world.exec('favorites.list', undefined, bruno))).toEqual([])
    expect(await world.exec('favorites.list', undefined, {})).toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    })
    expect(await world.exec('favorites.add', { nftId: 'nft_missing' }, ana)).toMatchObject({
      error: { code: 'NOT_FOUND' },
    })
    expect(ok(await world.exec('favorites.remove', { nftId: 'nft_emerald-ape-042' }, ana))).toEqual([])
  })
})

describe('Sessions', () => {
  it('logs a fixture Collector in and recognizes the Session token', async () => {
    const { world } = await testWorld()
    const session = ok(await world.exec('auth.login', ANA, {}))
    expect(session.collector.email).toBe('ana@jungle.test')

    const current = ok(await world.exec('auth.session', undefined, { token: session.token }))
    expect(current.collector.id).toBe(session.collector.id)
  })

  it('expires a Session after its lifetime, distinctly from never having one', async () => {
    const { world, clock } = await testWorld()
    const { token } = ok(await world.exec('auth.login', ANA, {}))
    clock.advance(31 * 60 * 1000)
    expect(await world.exec('auth.session', undefined, { token })).toMatchObject({
      ok: false,
      error: { code: 'SESSION_EXPIRED', status: 401 },
    })
    expect(await world.exec('auth.session', undefined, { token: 'tok_unknown' })).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    })
  })

  it('lets Mock Control expire one Collector’s Session on demand, leaving others alone', async () => {
    const { world } = await testWorld()
    const ana = ok(await world.exec('auth.login', ANA, {}))
    const bruno = ok(await world.exec('auth.login', BRUNO, {}))
    world.control.expireSession(ana.collector.id)
    expect(await world.exec('auth.session', undefined, { token: ana.token })).toMatchObject({
      error: { code: 'SESSION_EXPIRED' },
    })
    expect((await world.exec('auth.session', undefined, { token: bruno.token })).ok).toBe(true)
  })

  it('invalidates the token on logout', async () => {
    const { world } = await testWorld()
    const { token } = ok(await world.exec('auth.login', ANA, {}))
    ok(await world.exec('auth.logout', undefined, { token }))
    expect(await world.exec('auth.session', undefined, { token })).toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    })
  })

  it('rejects a wrong password without saying which field was wrong', async () => {
    const { world } = await testWorld()
    const result = await world.exec('auth.login', { ...BRUNO, password: 'nope' }, {})
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIALS' } })
  })
})
