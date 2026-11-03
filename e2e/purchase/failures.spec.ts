// Scenario 7: payment failure, repeated clicks, and a lost response recovered as the same Order.
// Plus the Wallet Connection being rejected and retried.
import { expect, open, test } from '../fixtures'
import { anaWithCart, connectInReview, openReview, orderCount, orderStatuses, reload } from './helpers'

test('a rejected payment keeps the items and "Tentar novamente" starts a new attempt', async ({
  page,
  mock,
}) => {
  await open(page, '/', 'payment-rejected')
  await anaWithCart(page, '/pagamento')
  const dialog = await openReview(page)
  await connectInReview(page)
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()

  await expect(page.getByTestId('order-status')).toHaveText('Pagamento recusado')
  const card = page.getByTestId('order-card')
  await expect(card.getByText('A rede recusou o pagamento. Nenhum valor foi cobrado.')).toBeVisible()
  await expect(card.getByText('Seus itens continuam no carrinho.')).toBeVisible()
  // Never a confirmation for a rejected Order.
  await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toHaveCount(0)
  const rejectedUrl = page.url()

  await mock.setPaymentOutcome('confirm')
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page).toHaveURL(/\/pagamento$/)
  await expect(page.getByTestId('quoted-line')).toHaveCount(2)

  const again = await openReview(page)
  await connectInReview(page)
  await again.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  // A new attempt is a new key and a new Order.
  expect(page.url()).not.toBe(rejectedUrl)
  expect(await orderCount(page)).toBe(2)
})

test('repeated clicks on the final confirmation create exactly one Order', async ({ page }) => {
  await open(page, '/')
  await anaWithCart(page, '/pagamento')
  await openReview(page)
  await connectInReview(page)

  // Five clicks in the same task, before React can re-render the button as disabled.
  await page.evaluate(() => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find((b) =>
      b.textContent?.includes('Confirmar e pagar'),
    )
    for (let i = 0; i < 5; i++) button?.click()
  })

  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  expect(await orderCount(page)).toBe(1)
})

test('a lost Order response is recovered with the same key, never a second Order', async ({ page }) => {
  test.setTimeout(60_000)
  await open(page, '/', 'order-timeout')
  await anaWithCart(page, '/pagamento')
  const dialog = await openReview(page)
  await connectInReview(page)
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(dialog.getByRole('button', { name: 'Enviando pedido…' })).toBeDisabled()

  // The client gives up after its 10 s timeout and says what happened.
  const recovering = dialog.getByTestId('attempt-recovering')
  await expect(recovering).toBeVisible({ timeout: 20_000 })
  await expect(recovering).toContainText('você não será cobrado duas vezes')
  expect(await orderCount(page)).toBe(1)

  await recovering.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page).toHaveURL(/\/pedidos\/ord_/)
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  expect(await orderCount(page)).toBe(1)
})

test('a refresh while the Order response is lost resumes the same attempt', async ({ page, mock }) => {
  await open(page, '/')
  await anaWithCart(page, '/pagamento')
  const dialog = await openReview(page)
  await connectInReview(page)
  await mock.failNext('orders.create', 'drop')
  await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
  // The Order exists server-side; its response never arrives.
  await expect.poll(() => orderCount(page)).toBe(1)
  // Let the payment confirm first: the Cart is empty by the time the page comes back.
  await expect.poll(() => orderStatuses(page), { timeout: 15_000 }).toEqual(['confirmed'])

  await reload(page)
  // The saved attempt is resent with its key and resolves to the same Order.
  await expect(page).toHaveURL(/\/pedidos\/ord_/)
  await expect(page.getByTestId('order-status')).toHaveText('Seus NFTs agora estão na sua carteira')
  expect(await orderCount(page)).toBe(1)
})

test('a rejected Wallet Connection can be retried, and the Wallet disconnected', async ({ page, mock }) => {
  await open(page, '/', 'wallet-rejected')
  await anaWithCart(page, '/pagamento')
  const connection = page.getByTestId('wallet-connection')

  await connection.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(connection).toContainText('A carteira recusou a conexão')

  await mock.setWalletResponse('approve')
  await connection.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(connection).toContainText('Carteira Principal conectada.')

  await connection.getByRole('button', { name: 'Desconectar' }).click()
  await expect(connection.getByRole('button', { name: 'Conectar carteira' })).toBeVisible()
})
