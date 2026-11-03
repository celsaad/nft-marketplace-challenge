// The Mock API: one interface, two adapters (module-design §2) — the Mock Lab panel for people and
// `window.__mock` for Playwright. Every call changes the mock backend; none touches app state.
import { SCENARIO_STORAGE_KEY } from './boot-url'
import type { Failure, Network } from './http/network'
import type { RealtimeHub } from './realtime/hub'
import { type NetworkProfile, SCENARIO_NAMES, SCENARIOS, type ScenarioName } from './world/scenarios'
import type { Control, OpName, World } from './world/world'

export interface MockApi extends Control {
  readonly scenario: ScenarioName
  readonly scenarios: { name: ScenarioName; label: string; description: string }[]
  /** Switches Scenario (optionally from scratch) by reloading the page into it. */
  selectScenario(name: ScenarioName, options?: { reset?: boolean }): void
  setNetwork(profile: Partial<NetworkProfile>): void
  readonly network: NetworkProfile
  failNext(op: OpName | '*', failure: Failure): void
  dropRealtime(): void
  emitDuplicate(eventId?: string): void
  emitStale(resourceId: string): void
  realtimeConnections(): number
}

export function createMockApi(world: World, network: Network, hub: RealtimeHub): MockApi {
  return {
    ...world.control,
    scenario: world.scenario.name,
    scenarios: SCENARIO_NAMES.map((name) => ({
      name,
      label: SCENARIOS[name].label,
      description: SCENARIOS[name].description,
    })),
    selectScenario(name, options) {
      try {
        localStorage.setItem(SCENARIO_STORAGE_KEY, name)
      } catch {
        // Storage unavailable: the URL parameter below still selects it for this load.
      }
      const url = new URL(location.href)
      url.searchParams.set('scenario', name)
      if (options?.reset) url.searchParams.set('reset', '1')
      location.assign(url)
    },
    setNetwork: (profile) => network.setProfile(profile),
    get network() {
      return network.profile
    },
    failNext: (op, failure) => network.failNext(op, failure),
    dropRealtime: () => hub.dropAll(),
    emitDuplicate: (eventId) => hub.emitDuplicate(eventId),
    emitStale: (resourceId) => hub.emitStale(resourceId),
    realtimeConnections: () => hub.connectionCount(),
  }
}
