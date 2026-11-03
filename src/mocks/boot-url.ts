// The URL half of starting the mock backend: which Scenario, and whether to reset it. main.tsx runs
// it synchronously before the router reads the URL, because it rewrites the URL (drops `reset`).
import { isScenarioName, type ScenarioName } from './world/scenarios'

export const SCENARIO_STORAGE_KEY = 'kurio.mock.scenario'

export interface MockBoot {
  scenario: ScenarioName
  reset: boolean
}

function readStoredScenario(): string | null {
  try {
    return localStorage.getItem(SCENARIO_STORAGE_KEY)
  } catch {
    return null
  }
}

/** A Scenario named in the URL sticks, so in-app navigation and a refresh stay in it. */
function storeScenario(name: string) {
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, name)
  } catch {
    // Storage unavailable: the Scenario lasts for this load only.
  }
}

export function takeMockBoot(): MockBoot {
  const url = new URL(location.href)
  const requested = url.searchParams.get('scenario') ?? readStoredScenario()
  const scenario = isScenarioName(requested) ? requested : 'default'
  if (url.searchParams.has('scenario')) storeScenario(scenario)
  const reset = url.searchParams.has('reset')
  if (reset) {
    // Reset once; a later refresh must keep the state the user has built since.
    url.searchParams.delete('reset')
    history.replaceState(history.state, '', url)
  }
  return { scenario, reset }
}
