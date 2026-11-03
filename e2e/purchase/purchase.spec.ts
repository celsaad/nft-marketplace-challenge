// Scenario 6: a full purchase, from the Cart to the confirmed Receipt.
// The NFT detail page belongs to another slice, so the Cart is filled through the REST API it uses.
import { BRUNO, expect, open, test } from '../fixtures'
import { anaWithCart, connectInReview, NFT, openReview, orderCount, reload, signIn } from './helpers'

test('buys the Cart and shows the Receipt only once the payment is confirmed', async ({ page, mock }) => {
  await open(page, '/')
  await anaWithCart(page, '/carrinho')
  await expect(page.getByTestId('quote-total')).toHaveText('4.086 ETH')
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()

  await expect(page).toHaveURL(/\/pagamento$/)
  // Prefilled from the profile and the Primary Wallet.
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Souza')
  await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveValue('ana@jungle.test')
  await expect(page.getByLabel('Endereço da carteira')).toHaveValue(`0x${'a11ce'.padEnd(40, '0')}`)
  await expect(page.getByLabel('Nome ENS')).toHaveValue('anasouza')
  await expect(page.getByTestId('quoted-line')).toHaveCount(2)

  const dialog = await openReview(page)
  await expect(dialog.getByTestId('quote-total')).toHaveText('4.086 ETH')
  // Not connected yet: confirming is impossible.
  await expect(dialog.getByRole('button', { name: 'Confirmar e pagar' })).toBeDisabled()
  await connectInReview(page)
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()

  await expect(page).toHaveURL(/\/pedidos\/ord_/)
  await expect(page.getByTestId('order-status')).toHaveText('Aguardando confirmação do pagamento')
  await expect(page.getByRole('link', { name: 'Ver no explorador' })).toHaveCount(0)

  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  await expect(page.getByTestId('receipt-line')).toHaveCount(2)
  await expect(page.getByTestId('receipt-line').first()).toContainText(NFT.emerald.name)
  await expect(page.getByTestId('receipt-line').first()).toContainText('(x 2)')
  await expect(page.getByTestId('receipt-total')).toHaveText('4.086 ETH')
  await expect(page.getByRole('link', { name: 'Ver no explorador' })).toHaveAttribute(
    'href',
    /explorer\.kurio\.test\/tx\/0x/,
  )
  await expect(page.getByText('Simulado: nenhuma transação real foi feita.')).toBeVisible()
  expect(await orderCount(page)).toBe(1)

  // The Receipt is a snapshot: a later price change does not alter it.
  await mock.changePrice(NFT.emerald.nftId, '9.99')
  await reload(page)
  await expect(page.getByTestId('receipt-total')).toHaveText('4.086 ETH')

  // Only the purchased quantities left the Cart.
  await page.goto('/carrinho')
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})

test('shows another Collector’s Order as forbidden', async ({ page }) => {
  await open(page, '/')
  await anaWithCart(page, '/pagamento')
  const dialog = await openReview(page)
  await connectInReview(page)
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page).toHaveURL(/\/pedidos\/ord_/)
  const orderPath = new URL(page.url()).pathname

  await page.evaluate(() => localStorage.removeItem('kurio.session'))
  await page.goto('/')
  await signIn(page, BRUNO)
  await page.goto(orderPath)
  await expect(page.getByText('Este pedido pertence a outro colecionador.')).toBeVisible()
})
