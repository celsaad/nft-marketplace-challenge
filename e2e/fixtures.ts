// Shared Playwright fixtures. Every test gets a fresh browser context (so fresh storage) and opens
// the app in a chosen Scenario. The mock is driven only through window.__mock, the same Mock API
// the Mock Lab uses — never by writing app state (spec: no events triggered in the UI).
import { test as base, expect, type Page } from '@playwright/test'
import type { MockApi } from '../src/mocks/mock-api'
import type { ScenarioName } from '../src/mocks/world/scenarios'

export const ANA = { email: 'ana@jungle.test', password: 'Password123!' }
export const BRUNO = { email: 'bruno@jungle.test', password: 'Password123!' }

type MockCall = {
  [K in keyof MockApi]: MockApi[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never
}

/** Calls a Mock API method inside the page. */
export function mockOf(page: Page): MockCall {
  return new Proxy({} as MockCall, {
    get:
      (_target, method: string) =>
      (...args: unknown[]) =>
        page.evaluate(
          ([name, params]) => {
            const api = window.__mock as unknown as Record<string, (...a: unknown[]) => unknown>
            return api[name as string]?.(...(params as unknown[]))
          },
          [method, args] as const,
        ),
  })
}

/** Opens a path in a Scenario from a clean slate and waits until the mock backend is running. */
export async function open(page: Page, path = '/', scenario: ScenarioName = 'default') {
  const url = new URL(path, 'http://placeholder')
  url.searchParams.set('scenario', scenario)
  url.searchParams.set('reset', '1')
  await page.goto(`${url.pathname}${url.search}${url.hash}`)
  await page.waitForFunction(() => Boolean(window.__mock))
}

export const test = base.extend<{ mock: MockCall }>({
  mock: async ({ page }, use) => {
    await use(mockOf(page))
  },
})

export { expect }

declare global {
  interface Window {
    __mock?: MockApi
  }
}
