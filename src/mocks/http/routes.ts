// REST contract: every path the app may call, the World operation behind it, and how its input
// is read and validated. This table is the single description of the API surface.
import type { z } from 'zod'
import {
  ChangePasswordInputSchema,
  LoginInputSchema,
  SignupInputSchema,
  UpdateAvatarInputSchema,
  UpdateProfileInputSchema,
  WalletInputSchema,
} from '@/contracts/account'
import { CatalogQuerySchema } from '@/contracts/catalog'
import {
  AddCartLineInputSchema,
  ApplyCouponInputSchema,
  CreateOrderInputSchema,
  QuoteRequestSchema,
  SetQuantityInputSchema,
} from '@/contracts/purchase'
import type { OpName } from '../world/world'

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface Route {
  method: Method
  /** Path below the API base, MSW syntax (`:param`). */
  path: string
  op: OpName
  /** Where the operation's input comes from. */
  input?: 'body' | 'query'
  /** Validates `input` before the World sees it (422 VALIDATION on failure). */
  schema?: z.ZodType
  /** Merges path params into the input (e.g. `{ id }`). */
  params?: readonly string[]
}

export const ROUTES: Route[] = [
  { method: 'get', path: '/nfts', op: 'catalog.list', input: 'query', schema: CatalogQuerySchema },
  { method: 'get', path: '/nfts/:id', op: 'catalog.get', params: ['id'] },
  { method: 'get', path: '/nfts/:id/reviews', op: 'catalog.reviews', params: ['id'] },

  { method: 'post', path: '/auth/signup', op: 'auth.signup', input: 'body', schema: SignupInputSchema },
  { method: 'post', path: '/auth/login', op: 'auth.login', input: 'body', schema: LoginInputSchema },
  { method: 'get', path: '/auth/session', op: 'auth.session' },
  { method: 'post', path: '/auth/logout', op: 'auth.logout' },

  { method: 'get', path: '/me', op: 'profile.get' },
  { method: 'patch', path: '/me', op: 'profile.update', input: 'body', schema: UpdateProfileInputSchema },
  { method: 'put', path: '/me/avatar', op: 'profile.avatar', input: 'body', schema: UpdateAvatarInputSchema },
  {
    method: 'post',
    path: '/me/password',
    op: 'profile.password',
    input: 'body',
    schema: ChangePasswordInputSchema,
  },

  { method: 'get', path: '/favorites', op: 'favorites.list' },
  { method: 'put', path: '/favorites/:nftId', op: 'favorites.add', params: ['nftId'] },
  { method: 'delete', path: '/favorites/:nftId', op: 'favorites.remove', params: ['nftId'] },

  { method: 'get', path: '/cart', op: 'cart.get' },
  { method: 'post', path: '/cart/lines', op: 'cart.addLine', input: 'body', schema: AddCartLineInputSchema },
  {
    method: 'patch',
    path: '/cart/lines/:lineId',
    op: 'cart.setQuantity',
    input: 'body',
    schema: SetQuantityInputSchema,
    params: ['lineId'],
  },
  { method: 'delete', path: '/cart/lines/:lineId', op: 'cart.removeLine', params: ['lineId'] },
  {
    method: 'put',
    path: '/cart/coupon',
    op: 'cart.applyCoupon',
    input: 'body',
    schema: ApplyCouponInputSchema,
  },
  { method: 'delete', path: '/cart/coupon', op: 'cart.removeCoupon' },

  { method: 'post', path: '/quotes', op: 'quote.create', input: 'body', schema: QuoteRequestSchema },

  { method: 'post', path: '/orders', op: 'orders.create', input: 'body', schema: CreateOrderInputSchema },
  { method: 'get', path: '/orders/:id', op: 'orders.get', params: ['id'] },

  { method: 'get', path: '/wallets', op: 'wallets.list' },
  { method: 'post', path: '/wallets', op: 'wallets.create', input: 'body', schema: WalletInputSchema },
  {
    method: 'patch',
    path: '/wallets/:id',
    op: 'wallets.update',
    input: 'body',
    schema: WalletInputSchema,
    params: ['id'],
  },
  { method: 'post', path: '/wallets/:id/connect', op: 'wallets.connect', params: ['id'] },
  { method: 'post', path: '/wallets/:id/disconnect', op: 'wallets.disconnect', params: ['id'] },
]
