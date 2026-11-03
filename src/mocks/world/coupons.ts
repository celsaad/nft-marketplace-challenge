import { compare, type Eth, eth, isZero, percentOf } from '@/lib/money/eth'
import type { CouponRecord } from './state'

export type CouponEvaluation =
  | { status: 'applied'; coupon: CouponRecord; discount: Eth }
  | { status: 'invalid' | 'expired' | 'minimum-not-met'; coupon: CouponRecord | null; discount: Eth }

const ZERO = eth('0')

/** Decides whether a Coupon applies to a subtotal right now, and how much it takes off. */
export function evaluateCoupon(
  coupon: CouponRecord | undefined,
  subtotal: Eth,
  now: number,
): CouponEvaluation {
  if (!coupon) return { status: 'invalid', coupon: null, discount: ZERO }
  if (coupon.expiresAt !== null && coupon.expiresAt <= now)
    return { status: 'expired', coupon, discount: ZERO }
  if (isZero(subtotal) || (coupon.minSubtotal && compare(subtotal, coupon.minSubtotal) < 0)) {
    return { status: 'minimum-not-met', coupon, discount: ZERO }
  }
  const raw = coupon.kind === 'percent' ? percentOf(subtotal, Number(coupon.value)) : eth(coupon.value)
  // A fixed Coupon never discounts more than the subtotal.
  return { status: 'applied', coupon, discount: compare(raw, subtotal) > 0 ? subtotal : raw }
}
