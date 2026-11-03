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

describe('Realtime events and changing Carts', () => {
  it('announces a price drop to everyone and reports it once in the next Quote', async () => {
    const { world, ana, events } = await loggedIn()
    const cart = ok(await world.exec('cart.addLine', { ...EMERALD, quantity: 2 }, ana))
    ok(await world.exec('quote.create', { paymentNetwork: 'ethereum' }, ana))

    world.control.changePrice(EMERALD.nftId, '0.99')
    expect(events.at(-1)).toMatchObject({
      audience: 'all',
      event: {
        type: 'nft.updated',
        resourceId: EMERALD.nftId,
        version: 2,
        userId: null,
        payload: { price: '0.99', previousPrice: '1.19', soldOut: false },
      },
    })

    const quote = ok(await world.exec('quote.create', { paymentNetwork: 'ethereum' }, ana))
    expect(quote.subtotal).toBe('1.98')
    expect(quote.issues).toEqual([
      { kind: 'price-changed', lineId: cart.lines[0]?.id, from: '1.19', to: '0.99' },
    ])
    expect(ok(await world.exec('quote.create', { paymentNetwork: 'ethereum' }, ana)).issues).toEqual([])
  })

  it('clamps lines to a lower Availability and removes sold-out lines, saying so', async () => {
    const { world, ana } = await loggedIn()
    world.control.setAvailability(EMERALD.editionId, 5)
    ok(await world.exec('cart.addLine', { ...EMERALD, quantity: 4 }, ana))
    const cart = ok(await world.exec('cart.addLine', { ...GOLDEN, quantity: 1 }, ana))
    const [emeraldLine, goldenLine] = cart.lines

    world.control.setAvailability(EMERALD.editionId, 2)
    world.control.setAvailability(GOLDEN.editionId, 0)

    const quote = ok(await world.exec('quote.create', { paymentNetwork: 'ethereum' }, ana))
    expect(quote.issues).toEqual([
      { kind: 'quantity-reduced', lineId: emeraldLine?.id, from: 4, to: 2 },
      { kind: 'sold-out', lineId: goldenLine?.id },
    ])
    expect(quote.subtotal).toBe('2.38')
    expect(ok(await world.exec('cart.get', undefined, ana)).lines.map((l) => l.quantity)).toEqual([2])
  })

  it('gives every event a unique id and a per-resource version that only grows', async () => {
    const { world, events } = await testWorld()
    world.control.changePrice(EMERALD.nftId, '2.5')
    world.control.setAvailability(EMERALD.editionId, 1)
    const nftEvents = events.filter((e) => e.event.resourceId === EMERALD.nftId)
    expect(nftEvents.map((e) => e.event.version)).toEqual([2, 3])
    expect(new Set(nftEvents.map((e) => e.event.eventId)).size).toBe(2)
    expect(nftEvents[0]?.event).toMatchObject({ payload: { price: '2.5', previousPrice: null } })
  })
})

const NEW_WALLET = {
  label: 'Carteira de testes',
  address: '0x1111111111111111111111111111111111111111',
  network: 'polygon' as const,
  provider: 'walletconnect' as const,
  isPrimary: false,
}

describe('Wallets', () => {
  it('shows each Collector only their own Wallets and forbids editing someone else’s', async () => {
    const { world, ana, bruno } = await loggedIn()
    const anaWallets = ok(await world.exec('wallets.list', undefined, ana))
    const brunoWallets = ok(await world.exec('wallets.list', undefined, bruno))
    expect(anaWallets.length).toBeGreaterThan(0)
    expect(anaWallets.some((w) => brunoWallets.some((b) => b.id === w.id))).toBe(false)

    const target = brunoWallets[0]
    expect(await world.exec('wallets.update', { id: target?.id ?? '', ...NEW_WALLET }, ana)).toMatchObject({
      error: { code: 'FORBIDDEN', status: 403 },
    })
  })

  it('validates addresses against the Network and keeps a single Primary Wallet', async () => {
    const { world, ana } = await loggedIn()
    expect(await world.exec('wallets.create', { ...NEW_WALLET, address: '0x123' }, ana)).toMatchObject({
      error: { code: 'VALIDATION', fieldErrors: { address: 'validation.walletAddress' } },
    })
    expect(await world.exec('wallets.create', { ...NEW_WALLET, network: 'solana' }, ana)).toMatchObject({
      error: { code: 'VALIDATION', fieldErrors: { address: 'validation.walletAddressNetwork' } },
    })

    const created = ok(await world.exec('wallets.create', { ...NEW_WALLET, isPrimary: true }, ana))
    const wallets = ok(await world.exec('wallets.list', undefined, ana))
    expect(wallets.filter((w) => w.isPrimary).map((w) => w.id)).toEqual([created.id])
  })

  it('approves or rejects a Wallet Connection as the mock world is told to', async () => {
    const { world, ana } = await loggedIn()
    const [wallet] = ok(await world.exec('wallets.list', undefined, ana))
    expect(ok(await world.exec('wallets.connect', { id: wallet?.id ?? '' }, ana))).toEqual({
      walletId: wallet?.id,
      status: 'approved',
    })
    world.control.setWalletResponse('reject')
    expect(await world.exec('wallets.connect', { id: wallet?.id ?? '' }, ana)).toMatchObject({
      error: { code: 'WALLET_REJECTED' },
    })
    expect(ok(await world.exec('wallets.disconnect', { id: wallet?.id ?? '' }, ana)).status).toBe(
      'disconnected',
    )
  })
})

const BUYER = {
  displayName: 'Ana Souza',
  username: 'ana_souza',
  profileName: 'Ana',
  email: 'ana@jungle.test',
  walletAddress: `0x${'a11ce'.padEnd(40, '0')}`,
  referralCode: 'KURIO',
  ensName: 'anasouza.eth',
}

/** Ana with 2 × Emerald Ape (1/10, 5 available) in her Cart, a connected Wallet and a fresh Quote. */
async function readyToBuy() {
  const t = await loggedIn()
  t.world.control.setAvailability(EMERALD.editionId, 5)
  ok(await t.world.exec('cart.addLine', { ...EMERALD, quantity: 2 }, t.ana))
  ok(await t.world.exec('wallets.connect', { id: 'w_ana_main' }, t.ana))
  const quote = ok(await t.world.exec('quote.create', { paymentNetwork: 'ethereum' }, t.ana))
  const input = {
    quoteId: quote.id,
    quoteHash: quote.hash,
    walletId: 'w_ana_main',
    paymentNetwork: 'ethereum' as const,
    buyer: BUYER,
  }
  const attempt = (key: string, override: Partial<typeof input> = {}) =>
    t.world.exec('orders.create', { ...input, ...override }, { ...t.ana, idempotencyKey: key })
  const availability = async () =>
    ok(await t.world.exec('cart.get', undefined, t.ana)).lines.find((l) => l.editionId === EMERALD.editionId)
      ?.edition.available
  return { ...t, quote, input, attempt, availability }
}

describe('Orders', () => {
  it('creates exactly one Order per Checkout Attempt, however often it is retried', async () => {
    const { attempt } = await readyToBuy()
    const first = ok(await attempt('key-1'))
    expect(first).toMatchObject({ status: 'pending', receipt: { subtotal: '2.38', total: '2.396' } })

    expect(ok(await attempt('key-1')).id).toBe(first.id)
    expect(await attempt('key-1', { walletId: 'w_ana_poly' })).toMatchObject({
      error: { code: 'IDEMPOTENCY_CONFLICT' },
    })
    expect(await attempt('')).toMatchObject({ error: { code: 'VALIDATION' } })
  })

  it('refuses a Stale Quote, a Wallet on another Network, and an unconnected Wallet', async () => {
    const { world, ana, attempt } = await readyToBuy()
    expect(await attempt('k-net', { walletId: 'w_ana_poly' })).toMatchObject({
      error: { code: 'WALLET_NETWORK_MISMATCH' },
    })
    ok(await world.exec('wallets.disconnect', { id: 'w_ana_main' }, ana))
    expect(await attempt('k-conn')).toMatchObject({ error: { code: 'WALLET_NOT_CONNECTED' } })
    ok(await world.exec('wallets.connect', { id: 'w_ana_main' }, ana))

    world.control.changePrice(EMERALD.nftId, '1.5')
    expect(await attempt('k-stale')).toMatchObject({ error: { code: 'QUOTE_STALE', status: 409 } })
  })

  it('confirms after payment: tells only the buyer, removes only what was bought, freezes the Receipt', async () => {
    const { world, ana, bruno, clock, events, attempt, availability } = await readyToBuy()
    const order = ok(await attempt('key-ok'))
    expect(await availability()).toBe(3)
    ok(await world.exec('cart.addLine', { ...GOLDEN, quantity: 1 }, ana))

    clock.advance(2500)
    const confirmed = ok(await world.exec('orders.get', { id: order.id }, ana))
    expect(confirmed).toMatchObject({ status: 'confirmed', version: 2 })
    expect(confirmed.transactionHash).toMatch(/^0x[0-9a-f]{64}$/)

    const orderEvents = events.filter((e) => e.event.type === 'order.updated')
    expect(orderEvents).toEqual([
      expect.objectContaining({
        audience: 'col_ana',
        event: expect.objectContaining({ resourceId: order.id, userId: 'col_ana', version: 2 }),
      }),
    ])
    expect(
      ok(await world.exec('cart.get', undefined, ana)).lines.map((l) => [l.editionId, l.quantity]),
    ).toEqual([[GOLDEN.editionId, 1]])

    world.control.changePrice(EMERALD.nftId, '9.99')
    expect(ok(await world.exec('orders.get', { id: order.id }, ana)).receipt.lines[0]?.unitPrice).toBe('1.19')
    expect(await world.exec('orders.get', { id: order.id }, bruno)).toMatchObject({
      error: { code: 'FORBIDDEN' },
    })
  })

  it('rejects when payment fails, keeping the Cart and releasing reserved Availability', async () => {
    const { world, ana, clock, attempt, availability } = await readyToBuy()
    world.control.setPaymentOutcome('reject')
    const order = ok(await attempt('key-rej'))
    clock.advance(2500)
    expect(ok(await world.exec('orders.get', { id: order.id }, ana))).toMatchObject({
      status: 'rejected',
      rejectionReason: 'payment-declined',
      transactionHash: null,
    })
    expect(ok(await world.exec('cart.get', undefined, ana)).lines.map((l) => l.quantity)).toEqual([2])
    expect(await availability()).toBe(5)
  })

  it('keeps an Order pending until resolved by hand, and never changes a terminal state', async () => {
    const { world, ana, clock, attempt } = await readyToBuy()
    world.control.setPaymentOutcome('manual')
    const order = ok(await attempt('key-man'))
    clock.advance(60_000)
    expect(ok(await world.exec('orders.get', { id: order.id }, ana)).status).toBe('pending')

    world.control.resolveOrder(order.id, 'confirmed')
    world.control.resolveOrder(order.id, 'rejected')
    expect(ok(await world.exec('orders.get', { id: order.id }, ana))).toMatchObject({
      status: 'confirmed',
      version: 2,
    })
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
