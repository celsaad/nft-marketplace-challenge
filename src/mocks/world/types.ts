// The World's interface types, shared by the per-resource operation modules.
import type {
  ChangePasswordInput,
  Collector,
  LoginInput,
  Session,
  SignupInput,
  UpdateAvatarInput,
  UpdateProfileInput,
  Wallet,
  WalletConnection,
  WalletInput,
} from '@/contracts/account'
import type { CatalogPage, CatalogQuery, NftDetail, Review } from '@/contracts/catalog'
import type { RealtimeEvent } from '@/contracts/events'
import type {
  AddCartLineInput,
  Cart,
  CreateOrderInput,
  Order,
  Quote,
  QuoteRequest,
} from '@/contracts/purchase'
import type { Core } from './core'
import type { Result } from './result'

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
  'catalog.list': [CatalogQuery, CatalogPage]
  'catalog.get': [{ id: string }, NftDetail]
  'catalog.reviews': [{ id: string }, Review[]]
  'auth.login': [LoginInput, Session]
  'auth.session': [undefined, Session]
  'auth.logout': [undefined, null]
  'auth.signup': [SignupInput, Session]
  'profile.get': [undefined, Collector]
  'profile.update': [UpdateProfileInput, Collector]
  'profile.avatar': [UpdateAvatarInput, Collector]
  'profile.password': [ChangePasswordInput, null]
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
export type OpName = keyof Ops

export type Handler<K extends OpName> = (core: Core, input: Ops[K][0], ctx: Ctx) => Promise<Result<Ops[K][1]>>
export type Handlers<K extends OpName> = { [P in K]: Handler<P> }

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
  /** Restores the Scenario's known state (and saves it). */
  reset(): void
}

/** An event plus who may receive it: every connection, or only one Collector's. */
export interface WorldMessage {
  event: RealtimeEvent
  audience: 'all' | string
}
