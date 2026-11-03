import type { Collector, LoginInput, Session } from '@/contracts/account'
import type { AddCartLineInput, Cart } from '@/contracts/purchase'
import { times } from '@/lib/money/eth'
import type { WorldDeps } from './deps'
import { seedState } from './fixtures'
import { verifyPassword } from './password'
import { type DomainError, fail, type Result, succeed } from './result'
import {
  type CartRecord,
  type CollectorRecord,
  type NftRecord,
  SESSION_TTL_MS,
  type WorldState,
} from './state'

/** Request-scoped facts the REST adapter extracts from headers. */
export interface Ctx {
  token?: string | null
  /** Guest Cart id (X-Cart-Id); ignored once the request carries a Session. */
  cartId?: string | null
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
}

/** Mock Control: how people (Mock Lab) and Playwright change the world. Never touches app state. */
export interface Control {
  /** Expires the Sessions of one Collector, or of everyone when omitted. */
  expireSession(collectorId?: string): void
  setAvailability(editionId: string, available: number): void
}
export type OpName = keyof Ops

export type ScenarioName = 'default'

export interface World {
  exec<K extends OpName>(op: K, input: Ops[K][0], ctx: Ctx): Promise<Result<Ops[K][1]>>
  subscribe(listener: (message: unknown) => void): () => void
  control: Control
}

const toCollector = ({ passwordHash: _h, passwordSalt: _s, ...collector }: CollectorRecord): Collector =>
  collector

export async function createWorld(deps: WorldDeps, _scenario: ScenarioName = 'default'): Promise<World> {
  const { clock, ids } = deps
  const state: WorldState = await seedState()
  const listeners = new Set<(message: unknown) => void>()

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
          nft.version++
        }
      }
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
