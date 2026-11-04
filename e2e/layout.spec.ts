// Every screen in the brief, at 320, 390, 768 and 1440 px, has no horizontal page overflow. 320 px
// is 1280 px at 400% zoom (WCAG reflow); the mobile project (touch) covers it, phone and tablet.
import type { Page } from '@playwright/test'
import { isMobile } from './catalog/helpers'
import { expect, open, test } from './fixtures'
import { addToCart, anaWithCart, connectInReview, NFT, openReview } from './purchase/helpers'

/**
 * How far the page scrolls sideways. Elements past the edge are listed for the report only: a
 * carousel parks its slides off-screen inside a clipped track, which is not page overflow.
 */
const overflow = (page: Page) =>
  page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > width + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`)
    return { excess: document.documentElement.scrollWidth - width, offenders }
  })

test('no screen scrolls sideways at the phone, tablet and desktop widths', async ({ page }, info) => {
  test.setTimeout(90_000)
  await open(page, '/')
  // A confirmed Receipt, then a fresh Cart, so every screen shows real content.
  await anaWithCart(page, '/pagamento')
  const dialog = await openReview(page)
  await connectInReview(page)
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  const receipt = new URL(page.url()).pathname
  await addToCart(page, NFT.emerald, 1)

  const screens: [path: string, ready: (p: Page) => ReturnType<Page['getByRole']>][] = [
    ['/', (p) => p.getByRole('heading', { level: 1 })],
    [`/nft/${NFT.sage.nftId}`, (p) => p.getByRole('heading', { name: NFT.sage.name })],
    ['/carrinho', (p) => p.getByTestId('quote-total')],
    ['/pagamento', (p) => p.getByTestId('quoted-line').first()],
    [receipt, (p) => p.getByTestId('receipt-total')],
    ['/perfil', (p) => p.getByRole('textbox', { name: 'Nome de exibição', exact: true })],
    ['/carteiras', (p) => p.getByRole('heading', { level: 1 })],
    ['/nao-existe', (p) => p.getByRole('heading', { name: 'Página não encontrada' })],
  ]
  const widths = isMobile(info) ? [320, 390, 768] : [1440]

  for (const width of widths) {
    // Sequential: one viewport, then one screen at a time.
    // oxlint-disable-next-line no-await-in-loop
    await page.setViewportSize({ width, height: 900 })
    for (const [path, ready] of screens) {
      // oxlint-disable-next-line no-await-in-loop
      await page.goto(path)
      // oxlint-disable-next-line no-await-in-loop
      await expect(ready(page)).toBeVisible()
      // oxlint-disable-next-line no-await-in-loop
      const { excess, offenders } = await overflow(page)
      expect(excess, `${path} at ${width}px overflows; past the edge: ${offenders.join(', ')}`).toBe(0)
    }
  }

  // Guest-only screens, signed out.
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear())
  for (const width of widths) {
    // oxlint-disable-next-line no-await-in-loop
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/entrar', '/cadastro']) {
      // oxlint-disable-next-line no-await-in-loop
      await page.goto(path)
      // oxlint-disable-next-line no-await-in-loop
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      // oxlint-disable-next-line no-await-in-loop
      const { excess, offenders } = await overflow(page)
      expect(excess, `${path} at ${width}px overflows; past the edge: ${offenders.join(', ')}`).toBe(0)
    }
  }
})
