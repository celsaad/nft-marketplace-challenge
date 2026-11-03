import {
  type Collector,
  type LoginInput,
  type Session,
  type Wallet,
  type WalletConnection,
  type WalletInput,
  WalletInputSchema,
} from '@/contracts/account'
import type { Network } from '@/contracts/common'
import type { RealtimeEvent } from '@/contracts/events'
import {
  type AddCartLineInput,
  type Cart,
  type CreateOrderInput,
  CreateOrderInputSchema,
  type Order,
  type Quote,
  type QuoteIssue,
  type QuoteRequest,
} from '@/contracts/purchase'
import { add, compare, eth, sub, times } from '@/lib/money/eth'
import { evaluateCoupon } from './coupons'
import type { WorldDeps } from './deps'
import { seedState } from './fixtures'
import { verifyPassword } from './password'
import { type DomainError, fail, type Result, succeed } from './result'
import {
  type CartRecord,
  type CollectorRecord,
  NETWORK_FEES,
  type NftRecord,
  type OrderRecord,
  PAYMENT_DELAY_MS,
  QUOTE_TTL_MS,
  SESSION_TTL_MS,
  type WalletRecord,
  type WorldState,
} from './state'
import { validate } from './validate'

/** Request-scoped facts the REST adapter extracts from headers. */
export interface Ctx {
  token?: string | null
  /** Guest Cart id (X-Cart-Id); ignored once the request carries a Session. */
  cartId?: string | null
  /** Idempotency-Key header of an Order creation (one per Checkout Attempt). */
  idempotencyKey?: string | null
}

/** Every operation the World exposes: [input, output]. */
export interface Ops {
  'auth.login': [LoginInput, Session]
  'auth.session': [undefined, Session]
  'auth.logout': [undefined, null]
  'favorites.list': [undefined, string[]]
  'favorites.add': [{ nftId: string }, string[]]
  'favorites.remove': [{ nftId: string }, string[]]
  'cart.get': [undefined, Cart]
  'cart.addLine': [AddCartLineInput, Cart]
  'cart.setQuantity': [{ lineId: string; quantity: number }, Cart]
  'cart.removeLine': [{ lineId: string }, Cart]
  'cart.applyCoupon': [{ code: string }, Cart]
  'cart.removeCoupon': [undefined, Cart]
  'quote.create': [QuoteRequest, Quote]
  'wallets.list': [undefined, Wallet[]]
  'wallets.create': [WalletInput, Wallet]
  'wallets.update': [WalletInput & { id: string }, Wallet]
  'wallets.connect': [{ id: string }, WalletConnection]
  'wallets.disconnect': [{ id: string }, WalletConnection]
  'orders.create': [CreateOrderInput, Order]
  'orders.get': [{ id: string }, Order]
}

/** FNV-1a: a short, stable fingerprint; not cryptographic, only needs to change when content does. */
function fingerprint(value: unknown): string {
  let hash = 0x811c9dc5
  for (const char of JSON.stringify(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Mock Control: how people (Mock Lab) and Playwright change the world. Never touches app state. */
export interface Control {
  /** Expires the Sessions of one Collector, or of everyone when omitted. */
  expireSession(collectorId?: string): void
  setAvailability(editionId: string, available: number): void
  changePrice(nftId: string, price: string): void
  /** How the simulated Wallet answers the next connection requests. */
  setWalletResponse(response: 'approve' | 'reject'): void
  /** How simulated payments of new Orders end; 'manual' waits for resolveOrder. */
  setPaymentOutcome(outcome: 'confirm' | 'reject' | 'manual'): void
  resolveOrder(orderId: string, status: 'confirmed' | 'rejected'): void
}
export type OpName = keyof Ops

export type ScenarioName = 'default'

/** An event plus who may receive it: every connection, or only one Collector's. */
export interface WorldMessage {
  event: RealtimeEvent
  audience: 'all' | string
}

export interface World {
  exec<K extends OpName>(op: K, input: Ops[K][0], ctx: Ctx): Promise<Result<Ops[K][1]>>
  subscribe(listener: (message: WorldMessage) => void): () => void
  control: Control
}

const toCollector = ({ passwordHash: _h, passwordSalt: _s, ...collector }: CollectorRecord): Collector =>
  collector

export async function createWorld(deps: WorldDeps, _scenario: ScenarioName = 'default'): Promise<World> {
  const { clock, ids } = deps
  const state: WorldState = await seedState()
  const listeners = new Set<(message: WorldMessage) => void>()

  function emit(event: RealtimeEvent, audience: WorldMessage['audience']) {
    for (const listener of listeners) listener({ event, audience })
  }

  /** Bumps an NFT's version and tells everyone its new Price and Availability. */
  function publishNft(nft: NftRecord) {
    nft.version++
    emit(
      {
        type: 'nft.updated',
        eventId: ids.next('evt'),
        resourceId: nft.id,
        version: nft.version,
        occurredAt: new Date(clock.now()).toISOString(),
        userId: null,
        payload: {
          price: nft.price,
          previousPrice: nft.previousPrice,
          editions: nft.editions.map((e) => ({ id: e.id, available: e.available })),
          soldOut: nft.editions.every((e) => e.available === 0),
        },
      },
      'all',
    )
  }

  function sessionFor(token: string, collectorId: string): Session {
    const record = state.sessions[token]
    const collector = state.collectors[collectorId]
    if (!record || !collector) throw new Error('session invariant broken')
    return { token, expiresAt: new Date(record.expiresAt).toISOString(), collector: toCollector(collector) }
  }

  function authenticate(ctx: Ctx): Result<CollectorRecord> {
    const record = ctx.token ? state.sessions[ctx.token] : undefined
    const collector = record && state.collectors[record.collectorId]
    if (!record || !collector) return fail('UNAUTHENTICATED', 'Authentication required')
    if (record.expiresAt <= clock.now()) return fail('SESSION_EXPIRED', 'Session expired')
    return succeed(collector)
  }

  /**
   * Prices a Cart against current Prices, Availability, Coupon and Network Fee without changing it.
   * `issues` lists everything that differs from what the Collector last saw.
   */
  function computeQuote(record: CartRecord, paymentNetwork: Network) {
    const issues: QuoteIssue[] = []
    const lines = record.lines.flatMap((line) => {
      const found = findEdition(line.nftId, line.editionId)
      const cap = found ? maxQuantity(found.nft, found.edition.available) : 0
      if (!found || cap === 0) {
        issues.push({ kind: 'sold-out', lineId: line.id })
        return []
      }
      const quantity = Math.min(line.quantity, cap)
      if (quantity < line.quantity) {
        issues.push({ kind: 'quantity-reduced', lineId: line.id, from: line.quantity, to: quantity })
      }
      const unitPrice = found.nft.price
      if (compare(unitPrice, line.seenPrice) !== 0) {
        issues.push({ kind: 'price-changed', lineId: line.id, from: line.seenPrice, to: unitPrice })
      }
      return [{ line, quantity, unitPrice, lineTotal: times(unitPrice, quantity) }]
    })
    const subtotal = lines.reduce((sum, l) => add(sum, l.lineTotal), eth('0'))

    let coupon: Quote['coupon'] = null
    let discount = eth('0')
    if (record.couponCode) {
      const result = evaluateCoupon(state.coupons[record.couponCode], subtotal, clock.now())
      if (result.status === 'applied') {
        discount = result.discount
        coupon = {
          code: result.coupon.code,
          status: 'applied',
          kind: result.coupon.kind,
          value: result.coupon.value,
        }
      } else {
        issues.push({ kind: 'coupon-dropped', code: record.couponCode, reason: result.status })
      }
    }

    const networkFee = eth(NETWORK_FEES[paymentNetwork])
    const total = add(sub(subtotal, discount), networkFee)
    const hash = fingerprint([
      lines.map((l) => [l.line.id, l.line.editionId, l.unitPrice, l.quantity]),
      coupon?.code ?? null,
      paymentNetwork,
      total,
    ])
    return { issues, lines, subtotal, coupon, discount, networkFee, total, hash }
  }

  const toOrder = ({ ownerId: _o, ...order }: OrderRecord): Order => order

  function schedulePayment(orderId: string) {
    const outcome = state.behavior.paymentOutcome
    if (outcome === 'manual') return
    clock.setTimeout(
      () => resolveOrder(orderId, outcome === 'reject' ? 'rejected' : 'confirmed'),
      PAYMENT_DELAY_MS,
    )
  }

  /** Moves a pending Order to its terminal state; terminal Orders never change again. */
  function resolveOrder(orderId: string, status: 'confirmed' | 'rejected') {
    const order = state.orders[orderId]
    if (!order || order.status !== 'pending') return
    order.status = status
    order.version++
    order.updatedAt = new Date(clock.now()).toISOString()

    if (status === 'confirmed') {
      order.transactionHash = `0x${fingerprint([order.id, 'tx']).repeat(8)}`
      order.explorerUrl = `https://explorer.kurio.test/tx/${order.transactionHash}`
      // Remove only the purchased quantities from the buyer's Cart.
      const cart = Object.values(state.carts).find((c) => c.ownerId === order.ownerId)
      if (cart) {
        for (const bought of order.receipt.lines) {
          const line = cart.lines.find((l) => l.editionId === bought.editionId)
          if (line) line.quantity -= bought.quantity
        }
        cart.lines = cart.lines.filter((l) => l.quantity > 0)
        cart.version++
      }
    } else {
      order.rejectionReason = 'payment-declined'
      // Release the reserved Availability.
      for (const bought of order.receipt.lines) {
        const found = findEdition(bought.nftId, bought.editionId)
        if (found) found.edition.available += bought.quantity
      }
      for (const nftId of new Set(order.receipt.lines.map((l) => l.nftId))) {
        const nft = state.nfts[nftId]
        if (nft) publishNft(nft)
      }
    }

    emit(
      {
        type: 'order.updated',
        eventId: ids.next('evt'),
        resourceId: order.id,
        version: order.version,
        occurredAt: order.updatedAt,
        userId: order.ownerId,
        payload: { status: order.status },
      },
      order.ownerId,
    )
  }

  const toWallet = ({ ownerId: _o, ...wallet }: WalletRecord): Wallet => wallet
  const walletsOf = (ownerId: string) => Object.values(state.wallets).filter((w) => w.ownerId === ownerId)

  function makePrimary(walletId: string) {
    const target = state.wallets[walletId]
    if (!target) return
    for (const w of walletsOf(target.ownerId)) w.isPrimary = w.id === walletId
  }

  /** A Wallet the caller owns; someone else's is FORBIDDEN, a missing one NOT_FOUND. */
  function ownedWallet(id: string, ctx: Ctx): Result<WalletRecord> {
    const auth = authenticate(ctx)
    if (!auth.ok) return auth
    const record = state.wallets[id]
    if (!record) return fail('NOT_FOUND', 'Wallet not found')
    if (record.ownerId !== auth.value.id) return fail('FORBIDDEN', 'Not your wallet')
    return succeed(record)
  }

  function findEdition(nftId: string, editionId: string) {
    const nft = state.nfts[nftId]
    const edition = nft?.editions.find((e) => e.id === editionId)
    return nft && edition ? { nft, edition } : null
  }

  const maxQuantity = (nft: NftRecord, available: number) => Math.min(available, nft.maxPerOrder)

  function serializeCart(cart: CartRecord): Cart {
    const lines = cart.lines.flatMap((line) => {
      const found = findEdition(line.nftId, line.editionId)
      if (!found) return []
      const { nft, edition } = found
      return [
        {
          id: line.id,
          nftId: nft.id,
          editionId: edition.id,
          quantity: line.quantity,
          nft: { name: nft.name, tokenId: nft.tokenId, image: nft.image, imageAlt: nft.imageAlt },
          edition: { size: edition.size, available: edition.available },
          maxQuantity: maxQuantity(nft, edition.available),
          unitPrice: nft.price,
          lineTotal: times(nft.price, line.quantity),
        },
      ]
    })
    return {
      id: cart.id,
      lines,
      couponCode: cart.couponCode,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      version: cart.version,
    }
  }

  function newCart(ownerId: string | null): CartRecord {
    const cart: CartRecord = { id: ids.next('cart'), ownerId, lines: [], couponCode: null, version: 1 }
    state.carts[cart.id] = cart
    return cart
  }

  /** The Collector's Cart when the request has a Session, otherwise the Guest Cart named by ctx.cartId. */
  function resolveCart(ctx: Ctx, { create }: { create: boolean }): Result<CartRecord> {
    if (ctx.token) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      const owned = Object.values(state.carts).find((c) => c.ownerId === auth.value.id)
      return succeed(owned ?? newCart(auth.value.id))
    }
    if (ctx.cartId) {
      const guest = state.carts[ctx.cartId]
      return guest && guest.ownerId === null ? succeed(guest) : fail('NOT_FOUND', 'Cart not found')
    }
    return create ? succeed(newCart(null)) : fail('NOT_FOUND', 'Cart not found')
  }

  /** Validates a target quantity for one Edition against Availability and the per-order limit. */
  function checkQuantity(nft: NftRecord, available: number, quantity: number): Result<null> {
    if (quantity > nft.maxPerOrder) return fail('QUANTITY_LIMIT', `At most ${nft.maxPerOrder} per order`)
    if (quantity > available) return fail('AVAILABILITY_CONFLICT', `Only ${available} available`)
    return succeed(null)
  }

  function mergeGuestCart(guestCartId: string | null | undefined, ownerId: string) {
    const guest = guestCartId ? state.carts[guestCartId] : undefined
    if (!guest || guest.ownerId !== null) return
    const owner = Object.values(state.carts).find((c) => c.ownerId === ownerId) ?? newCart(ownerId)
    for (const line of guest.lines) {
      const found = findEdition(line.nftId, line.editionId)
      if (!found) continue
      const existing = owner.lines.find((l) => l.editionId === line.editionId)
      const cap = maxQuantity(found.nft, found.edition.available)
      const quantity = Math.min(cap, (existing?.quantity ?? 0) + line.quantity)
      if (existing) existing.quantity = quantity
      else if (quantity > 0) owner.lines.push({ ...line, id: ids.next('line'), quantity })
    }
    owner.version++
    delete state.carts[guest.id]
  }

  const handlers: { [K in OpName]: (input: Ops[K][0], ctx: Ctx) => Promise<Result<Ops[K][1]>> } = {
    async 'auth.login'({ email, password }, ctx) {
      const collector = Object.values(state.collectors).find((c) => c.email === email.toLowerCase())
      if (!collector || !(await verifyPassword(password, collector.passwordSalt, collector.passwordHash))) {
        return fail('INVALID_CREDENTIALS', 'Invalid email or password')
      }
      const token = ids.next('tok')
      state.sessions[token] = { collectorId: collector.id, expiresAt: clock.now() + SESSION_TTL_MS }
      mergeGuestCart(ctx.cartId, collector.id)
      return succeed(sessionFor(token, collector.id))
    },

    async 'auth.session'(_input, ctx) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      return succeed(sessionFor(ctx.token as string, auth.value.id))
    },

    async 'auth.logout'(_input, ctx) {
      if (ctx.token) delete state.sessions[ctx.token]
      return succeed(null)
    },

    async 'favorites.list'(_input, ctx) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      return succeed(state.favorites[auth.value.id] ?? [])
    },

    async 'favorites.add'({ nftId }, ctx) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      if (!state.nfts[nftId]) return fail('NOT_FOUND', 'NFT not found')
      const current = (state.favorites[auth.value.id] ?? []).filter((id) => id !== nftId)
      state.favorites[auth.value.id] = [nftId, ...current]
      return succeed(state.favorites[auth.value.id] as string[])
    },

    async 'favorites.remove'({ nftId }, ctx) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      state.favorites[auth.value.id] = (state.favorites[auth.value.id] ?? []).filter((id) => id !== nftId)
      return succeed(state.favorites[auth.value.id] as string[])
    },

    async 'cart.get'(_input, ctx) {
      const cart = resolveCart(ctx, { create: true })
      return cart.ok ? succeed(serializeCart(cart.value)) : cart
    },

    async 'cart.addLine'({ nftId, editionId, quantity }, ctx) {
      const found = findEdition(nftId, editionId)
      if (!found) return fail('NOT_FOUND', 'NFT or Edition not found')
      const resolved = resolveCart(ctx, { create: true })
      if (!resolved.ok) return resolved
      const cart = resolved.value
      const existing = cart.lines.find((l) => l.editionId === editionId)
      const check = checkQuantity(found.nft, found.edition.available, (existing?.quantity ?? 0) + quantity)
      if (!check.ok) return check
      if (existing) existing.quantity += quantity
      else cart.lines.push({ id: ids.next('line'), nftId, editionId, quantity, seenPrice: found.nft.price })
      cart.version++
      return succeed(serializeCart(cart))
    },

    async 'cart.setQuantity'({ lineId, quantity }, ctx) {
      const resolved = resolveCart(ctx, { create: false })
      if (!resolved.ok) return resolved
      const line = resolved.value.lines.find((l) => l.id === lineId)
      const found = line && findEdition(line.nftId, line.editionId)
      if (!line || !found) return fail('NOT_FOUND', 'Cart line not found')
      const check = checkQuantity(found.nft, found.edition.available, quantity)
      if (!check.ok) return check
      line.quantity = quantity
      resolved.value.version++
      return succeed(serializeCart(resolved.value))
    },

    async 'cart.applyCoupon'({ code }, ctx) {
      const resolved = resolveCart(ctx, { create: false })
      if (!resolved.ok) return resolved
      const cart = serializeCart(resolved.value)
      const subtotal = cart.lines.reduce((sum, l) => add(sum, l.lineTotal), eth('0'))
      const normalized = code.trim().toUpperCase()
      const result = evaluateCoupon(state.coupons[normalized], subtotal, clock.now())
      if (result.status === 'invalid')
        return fail('COUPON_INVALID', 'Unknown coupon', { code: 'coupon.invalid' })
      if (result.status === 'expired')
        return fail('COUPON_EXPIRED', 'Coupon expired', { code: 'coupon.expired' })
      if (result.status === 'minimum-not-met') {
        return fail('COUPON_INVALID', 'Minimum not met', { code: 'coupon.minimum' })
      }
      resolved.value.couponCode = normalized
      resolved.value.version++
      return succeed(serializeCart(resolved.value))
    },

    async 'cart.removeCoupon'(_input, ctx) {
      const resolved = resolveCart(ctx, { create: false })
      if (!resolved.ok) return resolved
      resolved.value.couponCode = null
      resolved.value.version++
      return succeed(serializeCart(resolved.value))
    },

    async 'quote.create'({ paymentNetwork }, ctx) {
      const resolved = resolveCart(ctx, { create: false })
      if (!resolved.ok) return resolved
      const record = resolved.value
      const priced = computeQuote(record, paymentNetwork)

      // Bring the Cart in line with what the Quote found, so each change is reported only once.
      if (priced.issues.length > 0) {
        record.lines = priced.lines.map(({ line, quantity, unitPrice }) => ({
          ...line,
          quantity,
          seenPrice: unitPrice,
        }))
        if (priced.issues.some((i) => i.kind === 'coupon-dropped')) record.couponCode = null
        record.version++
      }

      const id = ids.next('quote')
      const expiresAt = clock.now() + QUOTE_TTL_MS
      state.quotes[id] = { id, cartId: record.id, hash: priced.hash, expiresAt }
      return succeed({
        id,
        hash: priced.hash,
        lines: priced.lines.map(({ line, quantity, unitPrice, lineTotal }) => ({
          lineId: line.id,
          unitPrice,
          quantity,
          lineTotal,
        })),
        subtotal: priced.subtotal,
        coupon: priced.coupon,
        discount: priced.discount,
        paymentNetwork,
        networkFee: priced.networkFee,
        total: priced.total,
        issues: priced.issues,
        expiresAt: new Date(expiresAt).toISOString(),
      })
    },

    async 'orders.create'(input, ctx) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      const key = ctx.idempotencyKey?.trim()
      if (!key)
        return fail('VALIDATION', 'Idempotency-Key required', { idempotencyKey: 'validation.required' })
      const valid = validate(CreateOrderInputSchema, input)
      if (!valid.ok) return valid

      // A retried Checkout Attempt resolves to its original Order, whatever happened since (ADR 0003).
      const slot = `${auth.value.id}:${key}`
      const attemptPrint = fingerprint(valid.value)
      const previous = state.idempotency[slot]
      if (previous) {
        if (previous.fingerprint !== attemptPrint) {
          return fail('IDEMPOTENCY_CONFLICT', 'Idempotency-Key reused with different content')
        }
        return succeed(toOrder(state.orders[previous.orderId] as OrderRecord))
      }

      const { quoteId, quoteHash, walletId, paymentNetwork, buyer: _buyer } = valid.value
      const wallet = ownedWallet(walletId, ctx)
      if (!wallet.ok) return wallet
      if (wallet.value.network !== paymentNetwork) {
        return fail('WALLET_NETWORK_MISMATCH', 'Wallet is on another network')
      }
      if (state.walletConnections[walletId] !== 'approved') {
        return fail('WALLET_NOT_CONNECTED', 'Connect the wallet first')
      }

      const cart = resolveCart(ctx, { create: false })
      if (!cart.ok) return cart
      const quote = state.quotes[quoteId]
      const priced = computeQuote(cart.value, paymentNetwork)
      const stale =
        !quote ||
        quote.cartId !== cart.value.id ||
        quote.hash !== quoteHash ||
        quote.expiresAt <= clock.now() ||
        priced.issues.length > 0 ||
        priced.hash !== quote.hash
      if (stale) return fail('QUOTE_STALE', 'Prices, availability or fees changed; review the new quote')
      if (priced.lines.length === 0)
        return fail('VALIDATION', 'Cart is empty', { cart: 'validation.emptyCart' })

      // Reserve Availability while the payment is pending.
      for (const { line, quantity } of priced.lines) {
        const found = findEdition(line.nftId, line.editionId)
        if (found) found.edition.available -= quantity
      }
      for (const nftId of new Set(priced.lines.map(({ line }) => line.nftId))) {
        const nft = state.nfts[nftId]
        if (nft) publishNft(nft)
      }

      const now = new Date(clock.now()).toISOString()
      const order: OrderRecord = {
        id: ids.next('ord'),
        ownerId: auth.value.id,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        version: 1,
        transactionHash: null,
        explorerUrl: null,
        rejectionReason: null,
        receipt: {
          lines: priced.lines.map(({ line, quantity, unitPrice, lineTotal }) => {
            const found = findEdition(line.nftId, line.editionId)
            return {
              nftId: line.nftId,
              editionId: line.editionId,
              name: found?.nft.name ?? '',
              tokenId: found?.nft.tokenId ?? '',
              image: found?.nft.image ?? '',
              imageAlt: found?.nft.imageAlt ?? '',
              editionSize: found?.edition.size ?? null,
              quantity,
              unitPrice,
              lineTotal,
            }
          }),
          subtotal: priced.subtotal,
          couponCode: priced.coupon?.code ?? null,
          discount: priced.discount,
          paymentNetwork,
          networkFee: priced.networkFee,
          total: priced.total,
          walletAddress: wallet.value.address,
        },
      }
      state.orders[order.id] = order
      state.idempotency[slot] = { fingerprint: attemptPrint, orderId: order.id }
      schedulePayment(order.id)
      return succeed(toOrder(order))
    },

    async 'orders.get'({ id }, ctx) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      const order = state.orders[id]
      if (!order) return fail('NOT_FOUND', 'Order not found')
      if (order.ownerId !== auth.value.id) return fail('FORBIDDEN', 'Not your order')
      return succeed(toOrder(order))
    },

    async 'wallets.list'(_input, ctx) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      return succeed(walletsOf(auth.value.id).map(toWallet))
    },

    async 'wallets.create'(input, ctx) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      const valid = validate(WalletInputSchema, input)
      if (!valid.ok) return valid
      const record = {
        ...valid.value,
        id: ids.next('w'),
        ownerId: auth.value.id,
        createdAt: new Date(clock.now()).toISOString(),
      }
      state.wallets[record.id] = record
      if (record.isPrimary || walletsOf(auth.value.id).length === 1) makePrimary(record.id)
      return succeed(toWallet(state.wallets[record.id] as WalletRecord))
    },

    async 'wallets.update'({ id, ...input }, ctx) {
      const owned = ownedWallet(id, ctx)
      if (!owned.ok) return owned
      const valid = validate(WalletInputSchema, input)
      if (!valid.ok) return valid
      Object.assign(owned.value, valid.value)
      if (valid.value.isPrimary) makePrimary(id)
      // A Collector always keeps one Primary Wallet.
      if (!walletsOf(owned.value.ownerId).some((w) => w.isPrimary)) owned.value.isPrimary = true
      return succeed(toWallet(owned.value))
    },

    async 'wallets.connect'({ id }, ctx) {
      const owned = ownedWallet(id, ctx)
      if (!owned.ok) return owned
      if (state.behavior.walletResponse === 'reject') {
        state.walletConnections[id] = 'disconnected'
        return fail('WALLET_REJECTED', 'The wallet rejected the connection')
      }
      state.walletConnections[id] = 'approved'
      return succeed({ walletId: id, status: 'approved' })
    },

    async 'wallets.disconnect'({ id }, ctx) {
      const owned = ownedWallet(id, ctx)
      if (!owned.ok) return owned
      state.walletConnections[id] = 'disconnected'
      return succeed({ walletId: id, status: 'disconnected' })
    },

    async 'cart.removeLine'({ lineId }, ctx) {
      const resolved = resolveCart(ctx, { create: false })
      if (!resolved.ok) return resolved
      resolved.value.lines = resolved.value.lines.filter((l) => l.id !== lineId)
      resolved.value.version++
      return succeed(serializeCart(resolved.value))
    },
  }

  const control: Control = {
    expireSession(collectorId) {
      for (const session of Object.values(state.sessions)) {
        if (!collectorId || session.collectorId === collectorId) session.expiresAt = clock.now()
      }
    },

    setAvailability(editionId, available) {
      for (const nft of Object.values(state.nfts)) {
        const edition = nft.editions.find((e) => e.id === editionId)
        if (edition) {
          edition.available = available
          publishNft(nft)
        }
      }
    },

    setWalletResponse(response) {
      state.behavior.walletResponse = response
    },

    setPaymentOutcome(outcome) {
      state.behavior.paymentOutcome = outcome
    },

    resolveOrder,

    changePrice(nftId, price) {
      const nft = state.nfts[nftId]
      if (!nft) return
      const next = eth(price)
      // A Previous Price is kept only while the new Price is lower (it's a price drop).
      nft.previousPrice = compare(next, nft.price) < 0 ? nft.price : null
      nft.price = next
      publishNft(nft)
    },
  }

  return {
    exec: (op, input, ctx) => handlers[op](input, ctx),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    control,
  }
}

export type { DomainError }
