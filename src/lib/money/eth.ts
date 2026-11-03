// ETH amounts travel as decimal strings and are calculated as bigint wei (ADR 0006).
// This module is the only place that converts between the two.

export type Eth = string & { readonly __brand: 'Eth' }

const DECIMALS = 18
const WEI_PER_ETH = 10n ** BigInt(DECIMALS)
const ETH_PATTERN = /^-?\d+(\.\d{1,18})?$/

function toWei(amount: Eth): bigint {
  const negative = amount.startsWith('-')
  const [whole = '0', fraction = ''] = (negative ? amount.slice(1) : amount).split('.')
  const wei = BigInt(whole) * WEI_PER_ETH + BigInt(fraction.padEnd(DECIMALS, '0'))
  return negative ? -wei : wei
}

function fromWei(wei: bigint): Eth {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const whole = abs / WEI_PER_ETH
  const fraction = (abs % WEI_PER_ETH).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  const text = fraction ? `${whole}.${fraction}` : `${whole}`
  return (negative ? `-${text}` : text) as Eth
}

/** Parses and normalizes a decimal ETH string. Throws on anything that isn't one. */
export function eth(value: string): Eth {
  if (!ETH_PATTERN.test(value)) throw new Error(`Invalid ETH amount: "${value}"`)
  return fromWei(toWei(value as Eth))
}

export function add(a: Eth, b: Eth): Eth {
  return fromWei(toWei(a) + toWei(b))
}

export function sub(a: Eth, b: Eth): Eth {
  return fromWei(toWei(a) - toWei(b))
}

export function compare(a: Eth, b: Eth): -1 | 0 | 1 {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff < 0n ? -1 : 1
}

/** A share of `amount` in basis points (1000 = 10%), rounded down so a discount never over-grants. */
export function percentOf(amount: Eth, basisPoints: number): Eth {
  return fromWei((toWei(amount) * BigInt(basisPoints)) / 10_000n)
}

/** Display form: at least two decimals, every significant digit kept, dot separator as in the Figma. */
export function formatEth(amount: Eth): string {
  const [whole, fraction = ''] = amount.split('.')
  return `${whole}.${fraction.padEnd(2, '0')} ETH`
}

/** Multiplies by a whole, non-negative quantity (quantities are always integers). */
export function times(amount: Eth, quantity: number): Eth {
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error(`Invalid quantity: ${quantity}`)
  return fromWei(toWei(amount) * BigInt(quantity))
}
