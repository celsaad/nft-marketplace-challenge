// The entry point into the mock backend: src/main.tsx imports this dynamically when VITE_MOCKS=on
// (after boot-url.ts has read the URL) and, once it resolves, lets the network layer start (ADR 0001, 0005).
import { setupWorker } from 'msw/browser'
import type { MockBoot } from './boot-url'
import { createHttpHandlers } from './http/handlers'
import { createNetwork } from './http/network'
import { createMockApi, type MockApi } from './mock-api'
import { createRealtimeHub } from './realtime/hub'
import { browserDeps } from './world/deps'
import { createWorld } from './world/world'

declare global {
  interface Window {
    __mock?: MockApi
  }
}

export async function startMocks(
  config: { apiBase: string; realtimeUrl: string },
  { scenario, reset }: MockBoot,
): Promise<MockApi> {
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
