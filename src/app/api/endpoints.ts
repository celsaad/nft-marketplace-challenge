// Typed REST endpoints (module-design §5): every response is parsed with its contract, so the
// UI only ever sees validated data. Paths mirror the route table the mock implements.
import { z } from 'zod'
import {
  type ChangePasswordInput,
  CollectorSchema,
  type LoginInput,
  SessionSchema,
  type SignupInput,
  type UpdateAvatarInput,
  type UpdateProfileInput,
  WalletConnectionSchema,
  type WalletInput,
  WalletSchema,
} from '@/contracts/account'
import { CatalogPageSchema, type CatalogQuery, NftDetailSchema, ReviewSchema } from '@/contracts/catalog'
import { HEADERS } from '@/contracts/common'
import {
  type AddCartLineInput,
  CartSchema,
  type CreateOrderInput,
  OrderSchema,
  type QuoteRequest,
  QuoteSchema,
} from '@/contracts/purchase'
import { getSession, useSessionStore } from '../session/store'
import { http } from './client'
import { isApiError } from './errors'

type Options = { signal?: AbortSignal }

async function get<S extends z.ZodType>(schema: S, url: string, opts: Options & { params?: object } = {}) {
  const { data } = await http.get(url, { signal: opts.signal, params: opts.params })
  return schema.parse(data) as z.infer<S>
}

async function send<S extends z.ZodType>(
  schema: S,
  method: 'post' | 'put' | 'patch' | 'delete',
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  const { data } = await http.request({ method, url, data: body, headers })
  return schema.parse(data) as z.infer<S>
}

const NoContent = z.unknown().transform(() => null)

/** Remembers the Guest Cart id the server assigned, until the visitor logs in. */
const rememberGuestCart = <T extends { id: string }>(cart: T): T => {
  if (!getSession().token && getSession().guestCartId !== cart.id) {
    useSessionStore.setState({ guestCartId: cart.id })
  }
  return cart
}

async function guestSafe<T extends { id: string }>(load: () => Promise<T>): Promise<T> {
  try {
    return rememberGuestCart(await load())
  } catch (error) {
    // The Guest Cart vanished (mock reset, merged elsewhere): start a fresh one.
    if (isApiError(error) && error.kind === 'notFound' && !getSession().token && getSession().guestCartId) {
      useSessionStore.setState({ guestCartId: null })
      return rememberGuestCart(await load())
    }
    throw error
  }
}

export const api = {
  catalog: {
    list: (query: CatalogQuery, opts?: Options) =>
      get(CatalogPageSchema, '/nfts', { ...opts, params: query }),
    get: (id: string, opts?: Options) => get(NftDetailSchema, `/nfts/${encodeURIComponent(id)}`, opts),
    reviews: (id: string, opts?: Options) =>
      get(z.array(ReviewSchema), `/nfts/${encodeURIComponent(id)}/reviews`, opts),
  },
  auth: {
    login: (input: LoginInput) => send(SessionSchema, 'post', '/auth/login', input),
    signup: (input: SignupInput) => send(SessionSchema, 'post', '/auth/signup', input),
    session: (opts?: Options) => get(SessionSchema, '/auth/session', opts),
    logout: () => send(NoContent, 'post', '/auth/logout'),
  },
  profile: {
    get: (opts?: Options) => get(CollectorSchema, '/me', opts),
    update: (input: UpdateProfileInput) => send(CollectorSchema, 'patch', '/me', input),
    avatar: (input: UpdateAvatarInput) => send(CollectorSchema, 'put', '/me/avatar', input),
    password: (input: ChangePasswordInput) => send(NoContent, 'post', '/me/password', input),
  },
  favorites: {
    list: (opts?: Options) => get(z.array(z.string()), '/favorites', opts),
    add: (nftId: string) => send(z.array(z.string()), 'put', `/favorites/${encodeURIComponent(nftId)}`),
    remove: (nftId: string) => send(z.array(z.string()), 'delete', `/favorites/${encodeURIComponent(nftId)}`),
  },
  cart: {
    get: (opts?: Options) => guestSafe(() => get(CartSchema, '/cart', opts)),
    addLine: (input: AddCartLineInput) => guestSafe(() => send(CartSchema, 'post', '/cart/lines', input)),
    setQuantity: (lineId: string, quantity: number) =>
      send(CartSchema, 'patch', `/cart/lines/${encodeURIComponent(lineId)}`, { quantity }),
    removeLine: (lineId: string) => send(CartSchema, 'delete', `/cart/lines/${encodeURIComponent(lineId)}`),
    applyCoupon: (code: string) => send(CartSchema, 'put', '/cart/coupon', { code }),
    removeCoupon: () => send(CartSchema, 'delete', '/cart/coupon'),
  },
  quotes: {
    create: (input: QuoteRequest) => send(QuoteSchema, 'post', '/quotes', input),
  },
  orders: {
    create: (input: CreateOrderInput, idempotencyKey: string) =>
      send(OrderSchema, 'post', '/orders', input, { [HEADERS.idempotencyKey]: idempotencyKey }),
    get: (id: string, opts?: Options) => get(OrderSchema, `/orders/${encodeURIComponent(id)}`, opts),
  },
  wallets: {
    list: (opts?: Options) => get(z.array(WalletSchema), '/wallets', opts),
    create: (input: WalletInput) => send(WalletSchema, 'post', '/wallets', input),
    update: (id: string, input: WalletInput) =>
      send(WalletSchema, 'patch', `/wallets/${encodeURIComponent(id)}`, input),
    connect: (id: string) =>
      send(WalletConnectionSchema, 'post', `/wallets/${encodeURIComponent(id)}/connect`),
    disconnect: (id: string) =>
      send(WalletConnectionSchema, 'post', `/wallets/${encodeURIComponent(id)}/disconnect`),
  },
}
