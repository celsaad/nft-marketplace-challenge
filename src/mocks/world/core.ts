// What every operation module shares: the state, injected dependencies, saving and events,
// plus the Session checks nearly every operation starts with.
import type { Collector, Session } from '@/contracts/account'
import type { RealtimeEvent } from '@/contracts/events'
import type { Clock, IdSource } from './deps'
import { fail, type Result, succeed } from './result'
import type { CollectorRecord, WorldState } from './state'
import type { Ctx, WorldMessage } from './types'

export interface Core {
  /** Replaced wholesale by reset(); always read through `core.state`. */
  state: WorldState
  readonly clock: Clock
  readonly ids: IdSource
  /** Pending payment timers, so reset() can cancel them. */
  readonly timers: Set<number>
  save(): void
  emit(event: RealtimeEvent, audience: WorldMessage['audience']): void
}

/** FNV-1a: a short, stable fingerprint; not cryptographic, only needs to change when content does. */
export function fingerprint(value: unknown): string {
  let hash = 0x811c9dc5
  for (const char of JSON.stringify(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const nowIso = (core: Core) => new Date(core.clock.now()).toISOString()

export const toCollector = ({
  passwordHash: _h,
  passwordSalt: _s,
  ...collector
}: CollectorRecord): Collector => collector

export function authenticate(core: Core, ctx: Ctx): Result<CollectorRecord> {
  const record = ctx.token ? core.state.sessions[ctx.token] : undefined
  const collector = record && core.state.collectors[record.collectorId]
  if (!record || !collector) return fail('UNAUTHENTICATED', 'Authentication required')
  if (record.expiresAt <= core.clock.now()) return fail('SESSION_EXPIRED', 'Session expired')
  return succeed(collector)
}

export function sessionFor(core: Core, token: string, collectorId: string): Session {
  const record = core.state.sessions[token]
  const collector = core.state.collectors[collectorId]
  if (!record || !collector) throw new Error('session invariant broken')
  return { token, expiresAt: new Date(record.expiresAt).toISOString(), collector: toCollector(collector) }
}

/** Starts a Session for a Collector and returns its token. */
export function openSession(core: Core, collectorId: string): string {
  const token = core.ids.next('tok')
  core.state.sessions[token] = {
    collectorId,
    expiresAt: core.clock.now() + core.state.behavior.sessionTtlMs,
  }
  return token
}
