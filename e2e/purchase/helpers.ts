// Helpers for the purchase specs. Collectors sign in through the login form (fixtures.signIn).
// Cart Lines are added through the same REST API the NFT detail page uses, as setup; every
// assertion still observes the UI.
import type { Page } from '@playwright/test'
import { signIn } from '../fixtures'

export { signIn }

export const SESSION_KEY = 'kurio.session'

/** NFTs from the deterministic catalog (src/mocks/world/catalog-fixtures.ts). */
export const NFT = {
  emerald: {
    nftId: 'nft_emerald-ape-042',
    editionId: 'ed_emerald-ape-042_50',
    name: 'Emerald Ape #042',
    price: '1.19',
  },
  sage: {
    nftId: 'nft_sage-nomad-009',
    editionId: 'ed_sage-nomad-009_10',
    name: 'Sage Nomad #009',
    price: '1.69',
  },
  ivory: {
    nftId: 'nft_ivory-baron-088',
    editionId: 'ed_ivory-baron-088_1',
    name: 'Ivory Baron #088',
    price: '1.79',
  },
} as const

/** Reloads and waits for the mock backend (the URL no longer carries `reset`, so state survives). */
export async function reload(page: Page) {
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__mock))
}

/** Adds a Cart Line as the current visitor (Collector or Guest) through the REST API. */
export async function addToCart(page: Page, line: { nftId: string; editionId: string }, quantity = 1) {
  await page.evaluate(
    async ({ input, key }) => {
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}')
      const state = stored.state ?? {}
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (state.token) headers.Authorization = `Bearer ${state.token}`
      else if (state.guestCartId) headers['X-Cart-Id'] = state.guestCartId
      const response = await fetch('/api/cart/lines', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      })
      if (!response.ok) throw new Error(`add to cart failed: ${response.status}`)
      const cart = await response.json()
      if (!state.token && state.guestCartId !== cart.id) {
        localStorage.setItem(key, JSON.stringify({ state: { ...state, guestCartId: cart.id }, version: 1 }))
      }
    },
    { input: { nftId: line.nftId, editionId: line.editionId, quantity }, key: SESSION_KEY },
  )
}

/** Ana with a Cart of two Emerald Ape #042 and one Sage Nomad #009, on the given page. */
export async function anaWithCart(page: Page, path: string) {
  await signIn(page)
  await addToCart(page, NFT.emerald, 2)
  await addToCart(page, NFT.sage, 1)
  await page.goto(path)
}

/** From /pagamento: fill the one field nobody can prefill and open the review dialog. */
export async function openReview(page: Page) {
  await page.getByLabel('Código de indicação').fill('AMIGO-KURIO')
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise sua compra' })
  await dialog.waitFor()
  return dialog
}

/** In the review dialog: approve the simulated Wallet Connection. */
export async function connectInReview(page: Page) {
  const dialog = page.getByRole('dialog')
  const connect = dialog.getByRole('button', { name: 'Conectar carteira' })
  // The connection survives in the checkout draft, so a second attempt may already be connected.
  if (await connect.isVisible()) await connect.click()
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('[role=dialog] button')].find((b) =>
      b.textContent?.includes('Confirmar e pagar'),
    )
    return button && !(button as HTMLButtonElement).disabled
  })
}

/** The statuses of the Orders the mock backend holds (read from the persisted World, never from app state). */
export async function orderStatuses(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const scenario = localStorage.getItem('kurio.mock.scenario') ?? window.__mock?.scenario ?? 'default'
    const world = JSON.parse(localStorage.getItem(`kurio.mock.v1.${scenario}`) ?? '{}')
    return Object.values<{ status: string }>(world.orders ?? {}).map((o) => o.status)
  })
}

export const orderCount = async (page: Page) => (await orderStatuses(page)).length
