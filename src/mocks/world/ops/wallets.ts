// Wallets and the simulated Wallet Connection.
import { type Wallet, WalletInputSchema } from '@/contracts/account'
import { authenticate, type Core, nowIso } from '../core'
import { fail, type Result, succeed } from '../result'
import type { WalletRecord } from '../state'
import type { Ctx, Handlers, OpName } from '../types'
import { validate } from '../validate'

const toWallet = ({ ownerId: _o, ...wallet }: WalletRecord): Wallet => wallet

const walletsOf = (core: Core, ownerId: string) =>
  Object.values(core.state.wallets).filter((w) => w.ownerId === ownerId)

function makePrimary(core: Core, walletId: string) {
  const target = core.state.wallets[walletId]
  if (!target) return
  for (const w of walletsOf(core, target.ownerId)) w.isPrimary = w.id === walletId
}

/** A Wallet the caller owns; someone else's is FORBIDDEN, a missing one NOT_FOUND. */
export function ownedWallet(core: Core, id: string, ctx: Ctx): Result<WalletRecord> {
  const auth = authenticate(core, ctx)
  if (!auth.ok) return auth
  const record = core.state.wallets[id]
  if (!record) return fail('NOT_FOUND', 'Wallet not found')
  if (record.ownerId !== auth.value.id) return fail('FORBIDDEN', 'Not your wallet')
  return succeed(record)
}

export const walletHandlers = {
  async 'wallets.list'(core, _input, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    return succeed(walletsOf(core, auth.value.id).map(toWallet))
  },

  async 'wallets.create'(core, input, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    const valid = validate(WalletInputSchema, input)
    if (!valid.ok) return valid
    const record: WalletRecord = {
      ...valid.value,
      id: core.ids.next('w'),
      ownerId: auth.value.id,
      createdAt: nowIso(core),
    }
    core.state.wallets[record.id] = record
    if (record.isPrimary || walletsOf(core, auth.value.id).length === 1) makePrimary(core, record.id)
    return succeed(toWallet(record))
  },

  async 'wallets.update'(core, { id, ...input }, ctx) {
    const owned = ownedWallet(core, id, ctx)
    if (!owned.ok) return owned
    const valid = validate(WalletInputSchema, input)
    if (!valid.ok) return valid
    Object.assign(owned.value, valid.value)
    if (valid.value.isPrimary) makePrimary(core, id)
    // A Collector always keeps one Primary Wallet.
    if (!walletsOf(core, owned.value.ownerId).some((w) => w.isPrimary)) owned.value.isPrimary = true
    return succeed(toWallet(owned.value))
  },

  async 'wallets.connect'(core, { id }, ctx) {
    const owned = ownedWallet(core, id, ctx)
    if (!owned.ok) return owned
    if (core.state.behavior.walletResponse === 'reject') {
      core.state.walletConnections[id] = 'disconnected'
      return fail('WALLET_REJECTED', 'The wallet rejected the connection')
    }
    core.state.walletConnections[id] = 'approved'
    return succeed({ walletId: id, status: 'approved' })
  },

  async 'wallets.disconnect'(core, { id }, ctx) {
    const owned = ownedWallet(core, id, ctx)
    if (!owned.ok) return owned
    core.state.walletConnections[id] = 'disconnected'
    return succeed({ walletId: id, status: 'disconnected' })
  },
} satisfies Partial<Handlers<OpName>>
