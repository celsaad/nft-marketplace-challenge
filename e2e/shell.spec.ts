import { expect, open, test } from './fixtures'

test.describe('App shell', () => {
  test('renders the shell with a skip link first in the tab order', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
  })

  test('sends a Guest who opens a private screen to login, keeping the way back', async ({ page }) => {
    await open(page, '/perfil')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil/)
  })

  test('answers an unknown address with a 404 page', async ({ page }) => {
    await open(page, '/nao-existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('connects realtime and reconnects after the server drops it', async ({ page, mock }) => {
    await open(page)
    await expect.poll(() => mock.realtimeConnections()).toBe(1)
    await mock.dropRealtime()
    await expect.poll(() => mock.realtimeConnections()).toBe(1)
  })
})
