import { z } from 'zod'
import { EthSchema, IdSchema, IsoDateSchema } from './common'
import { OrderStatusSchema } from './purchase'

/** Envelope every realtime event carries (ADR 0002). */
const envelope = {
  eventId: IdSchema,
  /** Monotonic per resource; the client ignores anything not newer than what it has applied. */
  version: z.number().int(),
  occurredAt: IsoDateSchema,
}

export const NftUpdatedEventSchema = z.object({
  ...envelope,
  type: z.literal('nft.updated'),
  resourceId: IdSchema,
  /** Public events carry no Collector. */
  userId: z.null(),
  payload: z.object({
    price: EthSchema,
    previousPrice: EthSchema.nullable(),
    editions: z.array(z.object({ id: IdSchema, available: z.number().int() })),
    soldOut: z.boolean(),
  }),
})

export const OrderUpdatedEventSchema = z.object({
  ...envelope,
  type: z.literal('order.updated'),
  resourceId: IdSchema,
  userId: IdSchema,
  payload: z.object({ status: OrderStatusSchema }),
})

export const RealtimeEventSchema = z.discriminatedUnion('type', [
  NftUpdatedEventSchema,
  OrderUpdatedEventSchema,
])
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>
export type NftUpdatedEvent = z.infer<typeof NftUpdatedEventSchema>
export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEventSchema>

export const REALTIME_EVENT_TYPES = ['nft.updated', 'order.updated'] as const
