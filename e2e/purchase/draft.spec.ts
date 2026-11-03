// The checkout draft survives a Session Expiry for the same Collector, and only for them.
import { BRUNO, expect, open, test } from '../fixtures'
import { addToCart, anaWithCart, NFT, reload, signIn } from './helpers'

test('restores the checkout draft after the Session expires and the same Collector signs in again', async ({
  page,
  mock,
}) => {
  await open(page, '/')
  await anaWithCart(page, '/pagamento')
  await page.getByLabel('Código de indicação').fill('AMIGO-KURIO')
  await page.getByLabel('Observação do colecionador (opcional)').fill('Presente de aniversário')

  await mock.expireSession()
  await reload(page)
  await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)

  await signIn(page)
  await page.goto('/pagamento')
  await expect(page.getByTestId('draft-restored')).toBeVisible()
  await expect(page.getByLabel('Código de indicação')).toHaveValue('AMIGO-KURIO')
  await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue(
    'Presente de aniversário',
  )
})

test('discards the draft when a different Collector signs in', async ({ page, mock }) => {
  await open(page, '/')
  await anaWithCart(page, '/pagamento')
  await page.getByLabel('Código de indicação').fill('AMIGO-KURIO')

  await mock.expireSession()
  await reload(page)
  await expect(page).toHaveURL(/\/entrar/)

  await signIn(page, BRUNO)
  await addToCart(page, NFT.emerald, 1)
  await page.goto('/pagamento')
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Bruno Lima')
  await expect(page.getByLabel('Código de indicação')).toHaveValue('')
  await expect(page.getByTestId('draft-restored')).toHaveCount(0)
})
