import type { Collector, LoginInput, Session } from '@/contracts/account'
import type { WorldDeps } from './deps'
import { seedState } from './fixtures'
import { verifyPassword } from './password'
import { type DomainError, fail, type Result, succeed } from './result'
import { type CollectorRecord, SESSION_TTL_MS, type WorldState } from './state'

/** Request-scoped facts the REST adapter extracts from headers. */
export interface Ctx {
  token?: string | null
}

/** Every operation the World exposes: [input, output]. */
export interface Ops {
  'auth.login': [LoginInput, Session]
  'auth.session': [undefined, Session]
  'auth.logout': [undefined, null]
}

/** Mock Control: how people (Mock Lab) and Playwright change the world. Never touches app state. */
export interface Control {
  /** Expires the Sessions of one Collector, or of everyone when omitted. */
  expireSession(collectorId?: string): void
}
export type OpName = keyof Ops

export type ScenarioName = 'default'

export interface World {
  exec<K extends OpName>(op: K, input: Ops[K][0], ctx: Ctx): Promise<Result<Ops[K][1]>>
  subscribe(listener: (message: unknown) => void): () => void
  control: Control
}

const toCollector = ({ passwordHash: _h, passwordSalt: _s, ...collector }: CollectorRecord): Collector =>
  collector

export async function createWorld(deps: WorldDeps, _scenario: ScenarioName = 'default'): Promise<World> {
  const { clock, ids } = deps
  const state: WorldState = await seedState()
  const listeners = new Set<(message: unknown) => void>()

  function sessionFor(token: string, collectorId: string): Session {
    const record = state.sessions[token]
    const collector = state.collectors[collectorId]
    if (!record || !collector) throw new Error('session invariant broken')
    return { token, expiresAt: new Date(record.expiresAt).toISOString(), collector: toCollector(collector) }
  }

  function authenticate(ctx: Ctx): Result<CollectorRecord> {
    const record = ctx.token ? state.sessions[ctx.token] : undefined
    const collector = record && state.collectors[record.collectorId]
    if (!record || !collector) return fail('UNAUTHENTICATED', 'Authentication required')
    if (record.expiresAt <= clock.now()) return fail('SESSION_EXPIRED', 'Session expired')
    return succeed(collector)
  }

  const handlers: { [K in OpName]: (input: Ops[K][0], ctx: Ctx) => Promise<Result<Ops[K][1]>> } = {
    async 'auth.login'({ email, password }) {
      const collector = Object.values(state.collectors).find((c) => c.email === email.toLowerCase())
      if (!collector || !(await verifyPassword(password, collector.passwordSalt, collector.passwordHash))) {
        return fail('INVALID_CREDENTIALS', 'Invalid email or password')
      }
      const token = ids.next('tok')
      state.sessions[token] = { collectorId: collector.id, expiresAt: clock.now() + SESSION_TTL_MS }
      return succeed(sessionFor(token, collector.id))
    },

    async 'auth.session'(_input, ctx) {
      const auth = authenticate(ctx)
      if (!auth.ok) return auth
      return succeed(sessionFor(ctx.token as string, auth.value.id))
    },

    async 'auth.logout'(_input, ctx) {
      if (ctx.token) delete state.sessions[ctx.token]
      return succeed(null)
    },
  }

  const control: Control = {
    expireSession(collectorId) {
      for (const session of Object.values(state.sessions)) {
        if (!collectorId || session.collectorId === collectorId) session.expiresAt = clock.now()
      }
    },
  }

  return {
    exec: (op, input, ctx) => handlers[op](input, ctx),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    control,
  }
}

export type { DomainError }
