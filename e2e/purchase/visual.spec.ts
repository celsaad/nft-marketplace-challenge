// @visual baselines for the Cart and Pagamento on both projects, with deterministic data
// (fixture Collector, fixed Cart, default Scenario). Skipped on Linux CI per docs/decisions.md.

import { settleImages } from '../catalog/helpers'
import { expect, open, test } from '../fixtures'
import { anaWithCart } from './helpers'

test.describe('@visual purchase screens', () => {
  test.skip(process.platform === 'linux', 'Baselines are macOS Chromium')

  test('Carrinho de NFTs', async ({ page }) => {
    await open(page, '/')
    await anaWithCart(page, '/carrinho')
    await expect(page.getByTestId('quote-total')).toHaveText('4.086 ETH')
    await expect(page.getByText('Atualizando…')).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    await settleImages(page)
    await expect(page).toHaveScreenshot('cart.png', { fullPage: true })
  })

  test('Pagamento', async ({ page }) => {
    await open(page, '/')
    await anaWithCart(page, '/pagamento')
    await expect(page.getByTestId('quote-total')).toHaveText('4.086 ETH')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Souza')
    await page.waitForLoadState('networkidle')
    await settleImages(page)
    await expect(page).toHaveScreenshot('checkout.png', { fullPage: true })
  })
})
