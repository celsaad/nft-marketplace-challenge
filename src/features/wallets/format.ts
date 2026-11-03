import type { WalletProvider } from '@/contracts/account'
import type { Network } from '@/contracts/common'
import type { MessageKey } from '@/lib/i18n'

/** "0x1234…abcd": enough to recognise a Wallet without the full 42 characters. */
export function shortAddress(address: string, edge = 6): string {
  return address.length <= edge * 2 + 1 ? address : `${address.slice(0, edge)}…${address.slice(-4)}`
}

export const networkLabel = (network: Network): MessageKey => `account.network.${network}`
export const providerLabel = (provider: WalletProvider): MessageKey => `account.provider.${provider}`
