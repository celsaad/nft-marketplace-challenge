// Mock Control: every way the outside world (Mock Lab, Playwright) changes the simulation.
// Each call goes through the World's state and emits real events; nothing touches app state.
import { compare, eth } from '@/lib/money/eth'
import type { Core } from './core'
import { publishNft } from './ops/catalog'
import { resolveOrder } from './ops/orders'
import type { Control } from './types'

export function createControl(core: Core, seedJson: string): Control {
  const control: Control = {
    expireSession(collectorId) {
      for (const session of Object.values(core.state.sessions)) {
        if (!collectorId || session.collectorId === collectorId) session.expiresAt = core.clock.now()
      }
    },

    setAvailability(editionId, available) {
      for (const nft of Object.values(core.state.nfts)) {
        const edition = nft.editions.find((e) => e.id === editionId)
        if (edition) {
          edition.available = available
          publishNft(core, nft)
        }
      }
    },

    changePrice(nftId, price) {
      const nft = core.state.nfts[nftId]
      if (!nft) return
      const next = eth(price)
      // A Previous Price is kept only while the new Price is lower (it's a price drop).
      nft.previousPrice = compare(next, nft.price) < 0 ? nft.price : null
      nft.price = next
      publishNft(core, nft)
    },

    setWalletResponse(response) {
      core.state.behavior.walletResponse = response
    },

    setPaymentOutcome(outcome) {
      core.state.behavior.paymentOutcome = outcome
    },

    resolveOrder(orderId, status) {
      resolveOrder(core, orderId, status)
    },

    inspect() {
      return {
        nfts: Object.values(core.state.nfts).map((nft) => ({
          id: nft.id,
          name: nft.name,
          price: nft.price,
          editions: nft.editions.map(({ id, size, available }) => ({ id, size, available })),
        })),
        orders: Object.values(core.state.orders).map(({ id, ownerId, status, createdAt }) => ({
          id,
          ownerId,
          status,
          createdAt,
        })),
      }
    },

    reset() {
      for (const timer of core.timers) core.clock.clearTimeout(timer)
      core.timers.clear()
      core.state = JSON.parse(seedJson)
    },
  }

  // Every change is saved right away, so a reload always finds the latest state.
  return Object.fromEntries(
    Object.entries(control).map(([name, fn]) => [
      name,
      (...args: unknown[]) => {
        const result = (fn as (...a: unknown[]) => unknown)(...args)
        core.save()
        return result
      },
    ]),
  ) as unknown as Control
}
