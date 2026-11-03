import { type Eth, formatEth } from '@/lib/money/eth'
import { cn } from './lib/utils'

/** An ETH amount, always via formatEth so precision is never lost in display (ADR 0006). */
export function EthAmount({ value, className }: { value: Eth; className?: string }) {
  return <span className={cn('tabular-nums whitespace-nowrap', className)}>{formatEth(value)}</span>
}
