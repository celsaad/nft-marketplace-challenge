// The Mock World: the whole simulated backend behind one small interface (module-design §1).
import { createControl } from './control'
import type { Core } from './core'
import type { WorldDeps } from './deps'
import { seedState } from './fixtures'
import { accountHandlers } from './ops/account'
import { cartHandlers } from './ops/cart'
import { catalogHandlers } from './ops/catalog'
import { orderHandlers, resumePendingPayments } from './ops/orders'
import { walletHandlers } from './ops/wallets'
import type { DomainError, Result } from './result'
import { SCENARIOS, type ScenarioDefinition, type ScenarioName } from './scenarios'
import type { WorldState } from './state'
import type { Control, Ctx, Handlers, OpName, Ops, WorldMessage } from './types'

export type { Control, Ctx, DomainError, OpName, Ops, ScenarioName, WorldMessage }

export interface WorldOptions {
  scenario?: ScenarioName
  /** Ignore saved state and start the Scenario from scratch. */
  reset?: boolean
}

export interface World {
  exec<K extends OpName>(op: K, input: Ops[K][0], ctx: Ctx): Promise<Result<Ops[K][1]>>
  subscribe(listener: (message: WorldMessage) => void): () => void
  control: Control
  scenario: ScenarioDefinition & { name: ScenarioName }
}

export const STORAGE_PREFIX = 'kurio.mock.v1.'

const handlers: Handlers<OpName> = {
  ...catalogHandlers,
  ...accountHandlers,
  ...cartHandlers,
  ...walletHandlers,
  ...orderHandlers,
}

export async function createWorld(deps: WorldDeps, options: WorldOptions = {}): Promise<World> {
  const { clock, ids, storage } = deps
  const scenarioName = options.scenario ?? 'default'
  const scenario = SCENARIOS[scenarioName] as ScenarioDefinition
  const storageKey = `${STORAGE_PREFIX}${scenarioName}`

  // The Scenario's known state, kept as JSON so reset() can restore it synchronously.
  const seed = await seedState()
  scenario.prepare?.(seed)
  const seedJson = JSON.stringify(seed)
  const saved = options.reset ? null : storage.get(storageKey)

  const listeners = new Set<(message: WorldMessage) => void>()
  const core: Core = {
    state: JSON.parse(saved ?? seedJson) as WorldState,
    clock,
    ids,
    timers: new Set(),
    save: () => storage.set(storageKey, JSON.stringify(core.state)),
    emit(event, audience) {
      for (const listener of listeners) listener({ event, audience })
    },
  }
  core.save()
  resumePendingPayments(core)

  return {
    async exec(op, input, ctx) {
      const handler = handlers[op] as (
        core: Core,
        input: unknown,
        ctx: Ctx,
      ) => Promise<Result<Ops[typeof op][1]>>
      const result = await handler(core, input, ctx)
      core.save()
      return result
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    control: createControl(core, seedJson),
    scenario: { ...scenario, name: scenarioName },
  }
}
