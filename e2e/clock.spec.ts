// Time-sensitive scenarios under a controlled clock (Playwright page.clock): the 60 s session of
// the short-session Scenario, the simulated payment delay and the client's request timeout are
// jumped over instead of waited for. Time still flows normally between the jumps.
import { cards } from './catalog/helpers'
import { expect, open, signIn, test } from './fixtures'
import { anaWithCart, connectInReview, openReview } from './purchase/helpers'

test.beforeEach(async ({ page }) => {
  await page.clock.install()
})

test('a Session expires after its 60 s and the next action asks for login, keeping the way back', async ({
  page,
}) => {
  await open(page, '/', 'short-session')
  await signIn(page)
  await page.goto('/perfil')
  await expect(page.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Ana Souza')

  await page.clock.fastForward('01:01')
  await page.getByRole('link', { name: 'Carteiras' }).first().click()
  await expect(page).toHaveURL(/\/entrar\?.*redirect=%2Fcarteiras/)
  await expect(page.locator('main').getByText(/Sua sessão expirou/)).toBeVisible()
})

test('the Order stays pending until the simulated payment delay passes, then confirms', async ({ page }) => {
  await open(page, '/')
  await anaWithCart(page, '/pagamento')
  const dialog = await openReview(page)
  await connectInReview(page)
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByTestId('order-status')).toHaveText('Aguardando confirmação do pagamento')

  await page.clock.fastForward(2_600)
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
})

test('a request that never answers times out, explains itself and recovers on retry', async ({
  page,
  mock,
}) => {
  await open(page, '/')
  await expect(cards(page)).toHaveCount(9)
  // The query retries twice, so three hung requests make the failure stick.
  for (let i = 0; i < 3; i++) {
    // oxlint-disable-next-line no-await-in-loop
    await mock.failNext('catalog.list', 'timeout')
  }
  await page.getByRole('tab', { name: 'Em alta' }).click()
  const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar o catálogo' })
  // Jump past each 10 s client timeout and retry back-off until the failure sticks.
  await expect(async () => {
    await page.clock.fastForward(11_000)
    await expect(alert).toBeVisible({ timeout: 500 })
  }).toPass()
  await alert.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(cards(page).first()).toBeVisible()
  await expect(alert).toHaveCount(0)
})
