import { z } from 'zod'
import {
  EmailSchema,
  EnsNameSchema,
  ProfileNameSchema,
  ReferralCodeSchema,
  SecondaryAddressSchema,
  WalletAddressSchema,
} from './account'
import { EthSchema, IdSchema, IsoDateSchema, NetworkSchema } from './common'

export const CartLineSchema = z.object({
  id: IdSchema,
  nftId: IdSchema,
  editionId: IdSchema,
  quantity: z.number().int().positive(),
  nft: z.object({ name: z.string(), tokenId: z.string(), image: z.string(), imageAlt: z.string() }),
  edition: z.object({ size: z.number().int().nullable(), available: z.number().int() }),
  maxQuantity: z.number().int().min(0),
  unitPrice: EthSchema,
  lineTotal: EthSchema,
})
export type CartLine = z.infer<typeof CartLineSchema>

export const CartSchema = z.object({
  id: IdSchema,
  lines: z.array(CartLineSchema),
  couponCode: z.string().nullable(),
  itemCount: z.number().int(),
  version: z.number().int(),
})
export type Cart = z.infer<typeof CartSchema>

export const AddCartLineInputSchema = z.object({
  nftId: IdSchema,
  editionId: IdSchema,
  quantity: z.number().int().positive(),
})
export type AddCartLineInput = z.infer<typeof AddCartLineInputSchema>

export const SetQuantityInputSchema = z.object({ quantity: z.number().int().positive() })
export const ApplyCouponInputSchema = z.object({
  code: z.string().trim().min(1, 'validation.required').max(32),
})

export const QuoteRequestSchema = z.object({ paymentNetwork: NetworkSchema })
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>

export const COUPON_STATUSES = ['applied', 'invalid', 'expired', 'minimum-not-met'] as const

export const QuoteIssueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('price-changed'), lineId: IdSchema, from: EthSchema, to: EthSchema }),
  z.object({ kind: z.literal('quantity-reduced'), lineId: IdSchema, from: z.number(), to: z.number() }),
  z.object({ kind: z.literal('sold-out'), lineId: IdSchema }),
  z.object({ kind: z.literal('coupon-dropped'), code: z.string(), reason: z.enum(COUPON_STATUSES) }),
])
export type QuoteIssue = z.infer<typeof QuoteIssueSchema>

export const QuoteSchema = z.object({
  id: IdSchema,
  /** Changes whenever lines, Prices, Coupon or Network Fee change (ADR 0003). */
  hash: z.string(),
  lines: z.array(
    z.object({ lineId: IdSchema, unitPrice: EthSchema, quantity: z.number().int(), lineTotal: EthSchema }),
  ),
  subtotal: EthSchema,
  coupon: z
    .object({
      code: z.string(),
      status: z.enum(COUPON_STATUSES),
      kind: z.enum(['percent', 'fixed']),
      value: z.string(),
    })
    .nullable(),
  discount: EthSchema,
  paymentNetwork: NetworkSchema,
  networkFee: EthSchema,
  total: EthSchema,
  /** Changes the Collector must be told about, compared with the Cart they last saw. */
  issues: z.array(QuoteIssueSchema),
  expiresAt: IsoDateSchema,
})
export type Quote = z.infer<typeof QuoteSchema>

/** Fields of the Pagamento frame (prefilled from profile and Primary Wallet). */
export const BuyerDetailsSchema = z.object({
  displayName: z.string().trim().min(1, 'validation.required'),
  username: z.string().trim().min(1, 'validation.required'),
  profileName: ProfileNameSchema,
  email: EmailSchema,
  walletAddress: WalletAddressSchema,
  secondaryWallet: SecondaryAddressSchema.optional(),
  referralCode: ReferralCodeSchema,
  ensName: EnsNameSchema,
  note: z.string().max(500, 'validation.tooLong').optional(),
})
export type BuyerDetails = z.infer<typeof BuyerDetailsSchema>

export const CreateOrderInputSchema = z.object({
  quoteId: IdSchema,
  quoteHash: z.string(),
  walletId: IdSchema,
  paymentNetwork: NetworkSchema,
  buyer: BuyerDetailsSchema,
})
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>

export const ORDER_STATUSES = ['pending', 'confirmed', 'rejected'] as const
export const OrderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof OrderStatusSchema>

export const ReceiptSchema = z.object({
  lines: z.array(
    z.object({
      nftId: IdSchema,
      editionId: IdSchema,
      name: z.string(),
      tokenId: z.string(),
      image: z.string(),
      imageAlt: z.string(),
      editionSize: z.number().int().nullable(),
      quantity: z.number().int(),
      unitPrice: EthSchema,
      lineTotal: EthSchema,
    }),
  ),
  subtotal: EthSchema,
  couponCode: z.string().nullable(),
  discount: EthSchema,
  paymentNetwork: NetworkSchema,
  networkFee: EthSchema,
  total: EthSchema,
  walletAddress: z.string(),
})
export type Receipt = z.infer<typeof ReceiptSchema>

export const OrderSchema = z.object({
  id: IdSchema,
  status: OrderStatusSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  version: z.number().int(),
  receipt: ReceiptSchema,
  /** Simulated; present once confirmed. */
  transactionHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  rejectionReason: z.enum(['payment-declined', 'wallet-rejected']).nullable(),
})
export type Order = z.infer<typeof OrderSchema>
