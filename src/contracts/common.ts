import { z } from 'zod'
import { type Eth, eth } from '@/lib/money/eth'

/** ETH amount on the wire: a decimal string, normalized on parse (ADR 0006). */
export const EthSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,18})?$/, 'invalid ETH amount')
  .transform((value) => eth(value))
  .pipe(z.custom<Eth>())

export const IdSchema = z.string().min(1)
export const IsoDateSchema = z.iso.datetime()

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export const NetworkSchema = z.enum(NETWORKS)
export type Network = z.infer<typeof NetworkSchema>

export const LOCALES = ['pt-BR', 'en'] as const
export type Locale = (typeof LOCALES)[number]

/** Every error code the API can answer with; each maps to exactly one HTTP status. */
export const ERROR_STATUS = {
  VALIDATION: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  AVAILABILITY_CONFLICT: 409,
  QUANTITY_LIMIT: 409,
  COUPON_INVALID: 409,
  COUPON_EXPIRED: 409,
  QUOTE_STALE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  WALLET_REJECTED: 409,
  WALLET_NETWORK_MISMATCH: 409,
  TRANSIENT: 503,
} as const
export type ErrorCode = keyof typeof ERROR_STATUS
export const ErrorCodeSchema = z.enum(Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]])

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    /** Field path → message key, for VALIDATION / *_TAKEN errors. */
    fieldErrors: z.record(z.string(), z.string()).optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>

export const HEADERS = {
  authorization: 'Authorization',
  cartId: 'X-Cart-Id',
  idempotencyKey: 'Idempotency-Key',
} as const
