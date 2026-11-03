// Scenarios 9 and 10: realtime price/availability changes during the purchase, duplicate and stale
// events, and a connection drop + reload while an Order is pending.
import { expect, open, test } from '../fixtures'
import { anaWithCart, connectInReview, NFT, openReview, orderCount, reload } from './helpers'

test('a price change while the Cart is open is announced and re-quoted', async ({ page, mock }) => {
  await open(page, '/')
  await anaWithCart(page, '/carrinho')
  await expect(page.getByTestId('quote-total')).toHaveText('4.086 ETH')

  await mock.changePrice(NFT.emerald.nftId, '1.5')
  await expect(page.getByRole('status').filter({ hasText: 'Seu carrinho foi atualizado' })).toContainText(
    `${NFT.emerald.name}: o preço mudou de 1.19 ETH para 1.50 ETH.`,
  )
  // 2 × 1.5 + 1.69 + 0.016
  await expect(page.getByTestId('quote-total')).toHaveText('4.706 ETH')
})

test('an Availability drop while the Cart is open caps the line and says so', async ({ page, mock }) => {
  await open(page, '/')
  await anaWithCart(page, '/carrinho')
  await expect(page.getByTestId('quote-total')).toHaveText('4.086 ETH')

  await mock.setAvailability(NFT.emerald.editionId, 1)
  await expect(page.getByText(`${NFT.emerald.name}: a quantidade foi reduzida de 2 para 1`)).toBeVisible()
  await expect(
    page.getByRole('listitem', { name: NFT.emerald.name }).getByTestId('line-quantity'),
  ).toHaveText('1')
  await expect(page.getByTestId('quote-total')).toHaveText('2.896 ETH')
})

test('a price change during checkout blocks confirmation until the new Quote is accepted', async ({
  page,
  mock,
}) => {
  await open(page, '/')
  await anaWithCart(page, '/pagamento')
  const dialog = await openReview(page)
  await connectInReview(page)
  const confirm = dialog.getByRole('button', { name: 'Confirmar e pagar' })
  await expect(confirm).toBeEnabled()

  await mock.changePrice(NFT.emerald.nftId, '1.5')
  const changed = dialog.getByTestId('quote-changed')
  await expect(changed).toContainText('Os valores mudaram desde a sua revisão')
  await expect(changed).toContainText(`${NFT.emerald.name}: o preço mudou de 1.19 ETH para 1.50 ETH.`)
  await expect(changed).toContainText('Total: 4.086 ETH → 4.706 ETH')
  await expect(confirm).toBeDisabled()
  expect(await orderCount(page)).toBe(0)

  await changed.getByRole('button', { name: 'Aceitar novos valores' }).click()
  await expect(changed).toHaveCount(0)
  await expect(dialog.getByTestId('quote-total')).toHaveText('4.706 ETH')
  await confirm.click()

  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  await expect(page.getByTestId('receipt-total')).toHaveText('4.706 ETH')
})

test('duplicate and stale events never move a decided Order backwards', async ({ page, mock }) => {
  await open(page, '/', 'slow-confirm')
  await anaWithCart(page, '/pagamento')
  const dialog = await openReview(page)
  await connectInReview(page)
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByTestId('order-status')).toHaveText('Aguardando confirmação do pagamento')
  const orderId = new URL(page.url()).pathname.split('/').pop() as string

  await mock.resolveOrder(orderId, 'confirmed')
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')

  await mock.emitDuplicate()
  await mock.emitStale(orderId)
  await page.waitForTimeout(1000)
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  await expect(page.getByTestId('order-card')).toHaveAttribute('data-status', 'confirmed')
})

test('a connection drop and a reload while pending recover the same Order', async ({ page, mock }) => {
  await open(page, '/', 'slow-confirm')
  await anaWithCart(page, '/pagamento')
  const dialog = await openReview(page)
  await connectInReview(page)
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByTestId('order-status')).toHaveText('Aguardando confirmação do pagamento')
  const orderUrl = page.url()
  const orderId = new URL(orderUrl).pathname.split('/').pop() as string

  await mock.dropRealtime()
  await reload(page)
  expect(page.url()).toBe(orderUrl)
  await expect(page.getByTestId('order-status')).toHaveText('Aguardando confirmação do pagamento')

  // Going back to checkout doesn't resubmit: the pending Order is followed instead.
  await page.goto('/pagamento')
  await expect(page).toHaveURL(orderUrl)

  await mock.resolveOrder(orderId, 'confirmed')
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  expect(await orderCount(page)).toBe(1)
})
