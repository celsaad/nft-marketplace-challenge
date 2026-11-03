// Orders: idempotent creation, the simulated payment and its outcome (ADR 0003).
import { CreateOrderInputSchema, type Order } from '@/contracts/purchase'
import { authenticate, type Core, fingerprint, nowIso } from '../core'
import { fail, succeed } from '../result'
import { type OrderRecord, PAYMENT_DELAY_MS } from '../state'
import type { Handlers, OpName } from '../types'
import { validate } from '../validate'
import { cartOf, computeQuote, resolveCart } from './cart'
import { findEdition, publishNfts } from './catalog'
import { ownedWallet } from './wallets'

const toOrder = ({ ownerId: _o, ...order }: OrderRecord): Order => order

function schedulePayment(core: Core, orderId: string, delay = PAYMENT_DELAY_MS) {
  const outcome = core.state.behavior.paymentOutcome
  if (outcome === 'manual') return
  const timer = core.clock.setTimeout(() => {
    core.timers.delete(timer)
    resolveOrder(core, orderId, outcome === 'reject' ? 'rejected' : 'confirmed')
    core.save()
  }, delay)
  core.timers.add(timer)
}

/** After a reload, pending payments continue where they left off (never re-created). */
export function resumePendingPayments(core: Core) {
  for (const order of Object.values(core.state.orders)) {
    if (order.status !== 'pending') continue
    const remaining = Date.parse(order.createdAt) + PAYMENT_DELAY_MS - core.clock.now()
    schedulePayment(core, order.id, Math.max(0, remaining))
  }
}

/** Moves a pending Order to its terminal state; terminal Orders never change again. */
export function resolveOrder(core: Core, orderId: string, status: 'confirmed' | 'rejected') {
  const order = core.state.orders[orderId]
  if (!order || order.status !== 'pending') return
  order.status = status
  order.version++
  order.updatedAt = nowIso(core)

  if (status === 'confirmed') {
    order.transactionHash = `0x${fingerprint([order.id, 'tx']).repeat(8)}`
    order.explorerUrl = `https://explorer.kurio.test/tx/${order.transactionHash}`
    // Remove only the purchased quantities from the buyer's Cart.
    const cart = cartOf(core, order.ownerId)
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
      const found = findEdition(core, bought.nftId, bought.editionId)
      if (found) found.edition.available += bought.quantity
    }
    publishNfts(
      core,
      order.receipt.lines.map((l) => l.nftId),
    )
  }

  core.emit(
    {
      type: 'order.updated',
      eventId: core.ids.next('evt'),
      resourceId: order.id,
      version: order.version,
      occurredAt: order.updatedAt,
      userId: order.ownerId,
      payload: { status: order.status },
    },
    order.ownerId,
  )
}

export const orderHandlers = {
  async 'orders.create'(core, input, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    const key = ctx.idempotencyKey?.trim()
    if (!key) {
      return fail('VALIDATION', 'Idempotency-Key required', { idempotencyKey: 'validation.required' })
    }
    const valid = validate(CreateOrderInputSchema, input)
    if (!valid.ok) return valid

    // A retried Checkout Attempt resolves to its original Order, whatever happened since.
    const slot = `${auth.value.id}:${key}`
    const attemptPrint = fingerprint(valid.value)
    const previous = core.state.idempotency[slot]
    if (previous) {
      if (previous.fingerprint !== attemptPrint) {
        return fail('IDEMPOTENCY_CONFLICT', 'Idempotency-Key reused with different content')
      }
      return succeed(toOrder(core.state.orders[previous.orderId] as OrderRecord))
    }

    const { quoteId, quoteHash, walletId, paymentNetwork } = valid.value
    const wallet = ownedWallet(core, walletId, ctx)
    if (!wallet.ok) return wallet
    if (wallet.value.network !== paymentNetwork) {
      return fail('WALLET_NETWORK_MISMATCH', 'Wallet is on another network')
    }
    if (core.state.walletConnections[walletId] !== 'approved') {
      return fail('WALLET_NOT_CONNECTED', 'Connect the wallet first')
    }

    const cart = resolveCart(core, ctx, { create: false })
    if (!cart.ok) return cart
    const quote = core.state.quotes[quoteId]
    const priced = computeQuote(core, cart.value, paymentNetwork)
    const stale =
      !quote ||
      quote.cartId !== cart.value.id ||
      quote.hash !== quoteHash ||
      quote.expiresAt <= core.clock.now() ||
      priced.issues.length > 0 ||
      priced.hash !== quote.hash
    if (stale) return fail('QUOTE_STALE', 'Prices, availability or fees changed; review the new quote')
    if (priced.lines.length === 0) {
      return fail('VALIDATION', 'Cart is empty', { cart: 'validation.emptyCart' })
    }

    // Reserve Availability while the payment is pending.
    for (const { line, quantity } of priced.lines) {
      const found = findEdition(core, line.nftId, line.editionId)
      if (found) found.edition.available -= quantity
    }
    publishNfts(
      core,
      priced.lines.map(({ line }) => line.nftId),
    )

    const now = nowIso(core)
    const order: OrderRecord = {
      id: core.ids.next('ord'),
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
          const found = findEdition(core, line.nftId, line.editionId)
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
    core.state.orders[order.id] = order
    core.state.idempotency[slot] = { fingerprint: attemptPrint, orderId: order.id }
    schedulePayment(core, order.id)
    return succeed(toOrder(order))
  },

  async 'orders.get'(core, { id }, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    const order = core.state.orders[id]
    if (!order) return fail('NOT_FOUND', 'Order not found')
    if (order.ownerId !== auth.value.id) return fail('FORBIDDEN', 'Not your order')
    return succeed(toOrder(order))
  },
} satisfies Partial<Handlers<OpName>>
