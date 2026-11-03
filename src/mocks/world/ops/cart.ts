// Carts (Guest and Collector), Coupons and Quotes.
import type { Network } from '@/contracts/common'
import type { Cart, Quote, QuoteIssue } from '@/contracts/purchase'
import { add, compare, eth, sub, times } from '@/lib/money/eth'
import { authenticate, type Core, fingerprint } from '../core'
import { evaluateCoupon } from '../coupons'
import { fail, type Result, succeed } from '../result'
import { type CartRecord, NETWORK_FEES, type NftRecord, QUOTE_TTL_MS } from '../state'
import type { Ctx, Handlers, OpName } from '../types'
import { findEdition, maxQuantity } from './catalog'

export function serializeCart(core: Core, cart: CartRecord): Cart {
  const lines = cart.lines.flatMap((line) => {
    const found = findEdition(core, line.nftId, line.editionId)
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

function newCart(core: Core, ownerId: string | null): CartRecord {
  const cart: CartRecord = { id: core.ids.next('cart'), ownerId, lines: [], couponCode: null, version: 1 }
  core.state.carts[cart.id] = cart
  return cart
}

export const cartOf = (core: Core, ownerId: string) =>
  Object.values(core.state.carts).find((c) => c.ownerId === ownerId)

/** The Collector's Cart when the request has a Session, otherwise the Guest Cart named by ctx.cartId. */
export function resolveCart(core: Core, ctx: Ctx, { create }: { create: boolean }): Result<CartRecord> {
  if (ctx.token) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    return succeed(cartOf(core, auth.value.id) ?? newCart(core, auth.value.id))
  }
  if (ctx.cartId) {
    const guest = core.state.carts[ctx.cartId]
    return guest && guest.ownerId === null ? succeed(guest) : fail('NOT_FOUND', 'Cart not found')
  }
  return create ? succeed(newCart(core, null)) : fail('NOT_FOUND', 'Cart not found')
}

/** Validates a target quantity for one Edition against Availability and the per-order limit. */
function checkQuantity(nft: NftRecord, available: number, quantity: number): Result<null> {
  if (quantity > nft.maxPerOrder) return fail('QUANTITY_LIMIT', `At most ${nft.maxPerOrder} per order`)
  if (quantity > available) return fail('AVAILABILITY_CONFLICT', `Only ${available} available`)
  return succeed(null)
}

export function mergeGuestCart(core: Core, guestCartId: string | null | undefined, ownerId: string) {
  const guest = guestCartId ? core.state.carts[guestCartId] : undefined
  if (!guest || guest.ownerId !== null) return
  const owner = cartOf(core, ownerId) ?? newCart(core, ownerId)
  for (const line of guest.lines) {
    const found = findEdition(core, line.nftId, line.editionId)
    if (!found) continue
    const existing = owner.lines.find((l) => l.editionId === line.editionId)
    const cap = maxQuantity(found.nft, found.edition.available)
    const quantity = Math.min(cap, (existing?.quantity ?? 0) + line.quantity)
    if (existing) existing.quantity = quantity
    else if (quantity > 0) owner.lines.push({ ...line, id: core.ids.next('line'), quantity })
  }
  owner.version++
  delete core.state.carts[guest.id]
}

const subtotalOf = (cart: Cart) => cart.lines.reduce((sum, l) => add(sum, l.lineTotal), eth('0'))

/**
 * Prices a Cart against current Prices, Availability, Coupon and Network Fee without changing it.
 * `issues` lists everything that differs from what the Collector last saw.
 */
export function computeQuote(core: Core, record: CartRecord, paymentNetwork: Network) {
  const issues: QuoteIssue[] = []
  const lines = record.lines.flatMap((line) => {
    const found = findEdition(core, line.nftId, line.editionId)
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
    const result = evaluateCoupon(core.state.coupons[record.couponCode], subtotal, core.clock.now())
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

export const cartHandlers = {
  async 'cart.get'(core, _input, ctx) {
    const cart = resolveCart(core, ctx, { create: true })
    return cart.ok ? succeed(serializeCart(core, cart.value)) : cart
  },

  async 'cart.addLine'(core, { nftId, editionId, quantity }, ctx) {
    const found = findEdition(core, nftId, editionId)
    if (!found) return fail('NOT_FOUND', 'NFT or Edition not found')
    const resolved = resolveCart(core, ctx, { create: true })
    if (!resolved.ok) return resolved
    const cart = resolved.value
    const existing = cart.lines.find((l) => l.editionId === editionId)
    const check = checkQuantity(found.nft, found.edition.available, (existing?.quantity ?? 0) + quantity)
    if (!check.ok) return check
    if (existing) existing.quantity += quantity
    else
      cart.lines.push({ id: core.ids.next('line'), nftId, editionId, quantity, seenPrice: found.nft.price })
    cart.version++
    return succeed(serializeCart(core, cart))
  },

  async 'cart.setQuantity'(core, { lineId, quantity }, ctx) {
    const resolved = resolveCart(core, ctx, { create: false })
    if (!resolved.ok) return resolved
    const line = resolved.value.lines.find((l) => l.id === lineId)
    const found = line && findEdition(core, line.nftId, line.editionId)
    if (!line || !found) return fail('NOT_FOUND', 'Cart line not found')
    const check = checkQuantity(found.nft, found.edition.available, quantity)
    if (!check.ok) return check
    line.quantity = quantity
    resolved.value.version++
    return succeed(serializeCart(core, resolved.value))
  },

  async 'cart.removeLine'(core, { lineId }, ctx) {
    const resolved = resolveCart(core, ctx, { create: false })
    if (!resolved.ok) return resolved
    resolved.value.lines = resolved.value.lines.filter((l) => l.id !== lineId)
    resolved.value.version++
    return succeed(serializeCart(core, resolved.value))
  },

  async 'cart.applyCoupon'(core, { code }, ctx) {
    const resolved = resolveCart(core, ctx, { create: false })
    if (!resolved.ok) return resolved
    const normalized = code.trim().toUpperCase()
    const subtotal = subtotalOf(serializeCart(core, resolved.value))
    const result = evaluateCoupon(core.state.coupons[normalized], subtotal, core.clock.now())
    if (result.status === 'invalid') {
      return fail('COUPON_INVALID', 'Unknown coupon', { code: 'coupon.invalid' })
    }
    if (result.status === 'expired') {
      return fail('COUPON_EXPIRED', 'Coupon expired', { code: 'coupon.expired' })
    }
    if (result.status === 'minimum-not-met') {
      return fail('COUPON_INVALID', 'Minimum not met', { code: 'coupon.minimum' })
    }
    resolved.value.couponCode = normalized
    resolved.value.version++
    return succeed(serializeCart(core, resolved.value))
  },

  async 'cart.removeCoupon'(core, _input, ctx) {
    const resolved = resolveCart(core, ctx, { create: false })
    if (!resolved.ok) return resolved
    resolved.value.couponCode = null
    resolved.value.version++
    return succeed(serializeCart(core, resolved.value))
  },

  async 'quote.create'(core, { paymentNetwork }, ctx) {
    const resolved = resolveCart(core, ctx, { create: false })
    if (!resolved.ok) return resolved
    const record = resolved.value
    const priced = computeQuote(core, record, paymentNetwork)

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

    const id = core.ids.next('quote')
    const expiresAt = core.clock.now() + QUOTE_TTL_MS
    core.state.quotes[id] = { id, cartId: record.id, hash: priced.hash, expiresAt }
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
} satisfies Partial<Handlers<OpName>>
