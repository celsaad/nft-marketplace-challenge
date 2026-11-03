// Scenario 4: Favorites persist for the signed-in Collector; the toggle is optimistic and rolls
// back (with an accessible message) when the server fails.
import { ANA, expect, open, signIn, test } from '../fixtures'
import { card } from './helpers'

const heart = (page: import('@playwright/test').Page, name: string) =>
  card(page, name).getByRole('button', { name: `Favoritar ${name}` })

test.describe('Favorites', () => {
  test('a Guest is invited to sign in and come back', async ({ page }) => {
    await open(page, '/')
    await heart(page, 'Emerald Ape #042').click()
    const dialog = page.getByRole('dialog', { name: 'Entre para favoritar' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      /\/entrar\?redirect=%2F/,
    )
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(heart(page, 'Emerald Ape #042')).toBeFocused()
  })

  test('a Collector favorites an NFT, sees it in Favorites, and it persists', async ({ page }) => {
    await open(page, '/')
    await signIn(page, ANA)
    const button = heart(page, 'Emerald Ape #042')
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Adicionado aos favoritos.')).toBeVisible()

    await page.goto('/?favorites=true')
    await expect(page.getByRole('heading', { level: 1, name: 'Seus favoritos' })).toBeVisible()
    await expect(card(page, 'Emerald Ape #042')).toBeVisible()
    await page.reload()
    await expect(heart(page, 'Emerald Ape #042')).toHaveAttribute('aria-pressed', 'true')

    // Removing it from the Favorites view takes it off the list.
    await heart(page, 'Emerald Ape #042').click()
    await expect(card(page, 'Emerald Ape #042')).toHaveCount(0)
    await expect(page.getByText('Você ainda não favoritou nenhum NFT')).toBeVisible()
  })

  test('a failed toggle rolls back, says why, and works again on retry', async ({ page, mock }) => {
    await open(page, '/')
    await signIn(page, ANA)
    await mock.setNetwork({ latencyMs: [600, 600] })
    await mock.failNext('favorites.add', 'http503')
    const button = heart(page, 'Sage Nomad #009')

    await button.click()
    // Optimistic: on at once, before the server answers…
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    // …then back off when it fails, with the reason announced.
    await expect(
      page.getByText('Não foi possível atualizar seus favoritos. A alteração foi desfeita.'),
    ).toBeVisible()
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    await button.click()
    await expect(page.getByText('Adicionado aos favoritos.')).toBeVisible()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(heart(page, 'Sage Nomad #009')).toHaveAttribute('aria-pressed', 'true')
  })

  test('rapid toggles settle on the last intent', async ({ page, mock }) => {
    await open(page, '/')
    await signIn(page, ANA)
    await mock.setNetwork({ latencyMs: [400, 400] })
    const button = heart(page, 'Ivory Baron #088')
    // Key presses and clicks are sequential by nature.
    // oxlint-disable-next-line no-await-in-loop
    for (let i = 0; i < 5; i++) await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button).not.toHaveAttribute('aria-busy', 'true')
    await page.reload()
    await expect(heart(page, 'Ivory Baron #088')).toHaveAttribute('aria-pressed', 'true')
  })
})
