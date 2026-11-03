// Scenario 12: skeletons while data loads slowly, feedback on failure, recovery after retry.
// UI steps (clicks, key presses, queued failures) must happen in order.
/* oxlint-disable no-await-in-loop */
import { expect, open, test } from '../fixtures'
import { card, cards } from './helpers'

/** Transient failures are retried twice by the query policy, so three make the error stick. */
const failThrice = async (fail: () => Promise<unknown>) => {
  for (let i = 0; i < 3; i++) await fail()
}

test.describe('Loading, failure and recovery', () => {
  test('the catalog shows shimmer cards on a slow first load, then the results', async ({ page }) => {
    await open(page, '/', 'slow-network')
    await expect(page.getByTestId('nft-card-skeleton').first()).toBeVisible()
    await expect(page.getByRole('status', { name: 'Carregando conteúdo' }).first()).toBeVisible()
    await expect(card(page, 'Emerald Ape #042')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('nft-card-skeleton')).toHaveCount(0)
  })

  test('the detail shows its skeleton on a slow load', async ({ page }) => {
    await open(page, '/nft/nft_emerald-ape-042', 'slow-network')
    await expect(page.getByTestId('detail-skeleton')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('the previous page stays visible with a hint while the next one loads', async ({ page, mock }) => {
    await open(page, '/')
    await expect(card(page, 'Emerald Ape #042')).toBeVisible()
    await mock.setNetwork({ latencyMs: [2500, 2500] })
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page.getByText('Atualizando…')).toBeVisible()
    await expect(card(page, 'Emerald Ape #042')).toBeVisible()
    await expect(card(page, 'Emerald Ape #042')).toHaveCount(0, { timeout: 10_000 })
    await expect(page.getByText('Atualizando…')).toHaveCount(0)
  })

  test('a catalog failure explains itself and recovers on retry', async ({ page, mock }) => {
    await open(page, '/')
    await expect(cards(page)).toHaveCount(9)
    await failThrice(() => mock.failNext('catalog.list', 'http503'))
    await page.getByRole('tab', { name: 'Em alta' }).click()
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo' })
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await expect(alert).toContainText('instável')
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cards(page).first()).toBeVisible()
    await expect(alert).toHaveCount(0)
  })

  test('a detail failure explains itself and recovers on retry', async ({ page, mock }) => {
    await open(page, '/')
    await expect(cards(page)).toHaveCount(9)
    // Navigate inside the app: a full page load would start a fresh mock without the failures.
    await failThrice(() => mock.failNext('catalog.get', 'http503'))
    await card(page, 'Golden Beat #207').getByRole('link').click()
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar este NFT' })
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Golden Beat #207' })).toBeVisible()
  })
})
