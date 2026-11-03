// The price slider works in whole hundredths of ETH (slider steps). These are positions on a
// control, not money math: every amount that leaves here is an Eth string again (ADR 0006).
import { type Eth, eth } from '@/lib/money/eth'

/** Hundredths of ETH, rounded down (`up` rounds up so a range never excludes its own bounds). */
export function toSteps(amount: Eth, { up = false } = {}): number {
  const [whole = '0', fraction = ''] = amount.split('.')
  const steps = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, '0'))
  const remainder = /[1-9]/.test(fraction.slice(2))
  return up && remainder ? steps + 1 : steps
}

export function fromSteps(steps: number): Eth {
  const whole = Math.floor(steps / 100)
  const cents = String(steps % 100).padStart(2, '0')
  return eth(`${whole}.${cents}`)
}
