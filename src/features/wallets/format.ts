import type { WalletProvider } from '@/contracts/account'
import type { Network } from '@/contracts/common'
import type { MessageKey } from '@/lib/i18n'

export const networkLabel = (network: Network): MessageKey => `account.network.${network}`
export const providerLabel = (provider: WalletProvider): MessageKey => `account.provider.${provider}`
