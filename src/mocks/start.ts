// The only entry point into the mock backend: src/main.tsx imports this dynamically when
// VITE_MOCKS=on, awaits it, and only then renders and connects realtime (ADR 0001, 0005).
import { setupWorker } from 'msw/browser'
import { createHttpHandlers } from './http/handlers'
import { createNetwork } from './http/network'
import { createMockApi, type MockApi, SCENARIO_STORAGE_KEY } from './mock-api'
import { createRealtimeHub } from './realtime/hub'
import { browserDeps } from './world/deps'
import { isScenarioName } from './world/scenarios'
import { createWorld } from './world/world'

declare global {
  interface Window {
    __mock?: MockApi
  }
}

function readStoredScenario(): string | null {
  try {
    return localStorage.getItem(SCENARIO_STORAGE_KEY)
  } catch {
    return null
  }
}

export async function startMocks(config: { apiBase: string; realtimeUrl: string }): Promise<MockApi> {
  const url = new URL(location.href)
  const requested = url.searchParams.get('scenario') ?? readStoredScenario()
  const scenario = isScenarioName(requested) ? requested : 'default'
  const reset = url.searchParams.has('reset')
  if (reset) {
    // Reset once; a later refresh must keep the state the user has built since.
    url.searchParams.delete('reset')
    history.replaceState(history.state, '', url)
  }

  const world = await createWorld(browserDeps(), { scenario, reset })
  const network = createNetwork(world.scenario.network)
  const hub = createRealtimeHub(world, config.realtimeUrl)
  const worker = setupWorker(...createHttpHandlers(world, network, config.apiBase), hub.handler)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })

  const api = createMockApi(world, network, hub)
  window.__mock = api
  return api
}
