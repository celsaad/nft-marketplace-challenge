// Visual baselines for the catalog screens (macOS Chromium is the reference; see the config).
// Data is deterministic per Scenario, so nothing is masked.
import { expect, open, test } from '../fixtures'
import { card, settleImages } from './helpers'

test.describe('Catalog visuals', () => {
  test('home @visual', async ({ page }) => {
    await open(page, '/')
    await expect(card(page, 'Emerald Ape #042')).toBeVisible()
    await settleImages(page)
    await expect(page).toHaveScreenshot('home.png', { fullPage: true })
  })

  test('NFT detail @visual', async ({ page }) => {
    await open(page, '/nft/nft_emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mais desta coleção' })).toBeVisible()
    await expect(card(page, 'Sage Nomad #009')).toBeVisible()
    await settleImages(page)
    await expect(page).toHaveScreenshot('detail.png', { fullPage: true })
  })
})
