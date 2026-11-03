import type { Collector } from '@/contracts/account'
import type { NftDetail } from '@/contracts/catalog'
import type { Eth } from '@/lib/money/eth'

/** An NFT as stored; `soldOut` is derived from editions when serialized. */
export interface NftRecord extends Omit<NftDetail, 'soldOut'> {
  /** Popularity used by the "Em alta" tab. */
  trending: number
}

export interface CollectorRecord extends Collector {
  passwordSalt: string
  passwordHash: string
}

export interface SessionRecord {
  collectorId: string
  expiresAt: number
}

/** The whole mock database. Plain JSON so it can be saved to storage as-is. */
export interface WorldState {
  collectors: Record<string, CollectorRecord>
  sessions: Record<string, SessionRecord>
  nfts: Record<string, NftRecord>
  /** collectorId → NFT ids, most recent first. */
  favorites: Record<string, string[]>
  carts: Record<string, CartRecord>
  coupons: Record<string, CouponRecord>
  quotes: Record<string, QuoteRecord>
}

export interface CouponRecord {
  code: string
  kind: 'percent' | 'fixed'
  /** Basis points for percent Coupons (1000 = 10%); ETH for fixed ones. */
  value: string
  minSubtotal: Eth | null
  expiresAt: number | null
}

export interface QuoteRecord {
  id: string
  cartId: string
  hash: string
  expiresAt: number
}

export const QUOTE_TTL_MS = 10 * 60 * 1000

/** Network Fee per Payment Network (ADR 0008); Ethereum matches the Figma's 0.016 ETH. */
export const NETWORK_FEES = { ethereum: '0.016', polygon: '0.002', solana: '0.001' } as const

export interface CartLineRecord {
  id: string
  nftId: string
  editionId: string
  quantity: number
  /** The unit Price the Collector last saw for this line; drives "price changed" Quote issues. */
  seenPrice: Eth
}

export interface CartRecord {
  id: string
  /** null for a Guest Cart. */
  ownerId: string | null
  lines: CartLineRecord[]
  couponCode: string | null
  version: number
}

export const SESSION_TTL_MS = 30 * 60 * 1000
