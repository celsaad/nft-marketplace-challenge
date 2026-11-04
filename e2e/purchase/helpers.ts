// Helpers for the purchase specs. Collectors sign in through the login form (fixtures.signIn) and
// fill their Cart from the NFT detail page, as anyone would; the mock backend is read only through
// the Mock API (window.__mock), never through storage.
import type { Page } from '@playwright/test'
import { expect, mockOf, signIn } from '../fixtures'

export { signIn }

/** NFTs from the deterministic catalog (src/mocks/world/catalog-fixtures.ts). */
export const NFT = {
  emerald: {
    nftId: 'nft_emerald-ape-042',
    editionId: 'ed_emerald-ape-042_50',
    edition: '1/50',
    name: 'Emerald Ape #042',
    price: '1.19',
  },
  sage: {
    nftId: 'nft_sage-nomad-009',
    editionId: 'ed_sage-nomad-009_10',
    edition: '1/10',
    name: 'Sage Nomad #009',
    price: '1.69',
  },
  ivory: {
    nftId: 'nft_ivory-baron-088',
    editionId: 'ed_ivory-baron-088_1',
    edition: '1/1',
    name: 'Ivory Baron #088',
    price: '1.79',
  },
} as const

/** Reloads and waits for the mock backend (the URL no longer carries `reset`, so state survives). */
export async function reload(page: Page) {
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__mock))
}

/** Adds a Cart Line as the current visitor (Collector or Guest) from the NFT's detail page. */
export async function addToCart(
  page: Page,
  line: { nftId: string; edition: string; name: string },
  quantity = 1,
) {
  await page.goto(`/nft/${line.nftId}`)
  await page.getByRole('radio', { name: line.edition }).click()
  for (let i = 1; i < quantity; i++) {
    // Sequential clicks on the same stepper.
    // oxlint-disable-next-line no-await-in-loop
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  }
  await page
    .getByRole('button', { name: /^Comprar/ })
    .filter({ visible: true })
    .click()
  await expect(page.getByText(`${quantity}× ${line.name} (${line.edition}) no carrinho.`)).toBeVisible()
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

/** The statuses of the Orders the mock backend holds, read through the Mock API. */
export async function orderStatuses(page: Page): Promise<string[]> {
  return (await mockOf(page).inspect()).orders.map((order) => order.status)
}

export const orderCount = async (page: Page) => (await orderStatuses(page)).length
