// Scenario 5: Cart quantities, removal, Coupon, persistence after refresh and after login.
import { expect, open, test } from '../fixtures'
import { addToCart, NFT, reload, signIn } from './helpers'

test.describe('Cart', () => {
  test('collapses rapid stepper clicks into one change with the final quantity', async ({ page }) => {
    await open(page, '/')
    await signIn(page)
    await addToCart(page, NFT.emerald, 1)
    await page.goto('/carrinho')

    const line = page.getByRole('listitem', { name: NFT.emerald.name })
    await expect(line.getByTestId('line-quantity')).toHaveText('1')
    await expect(page.getByTestId('quote-total')).toHaveText('1.206 ETH')

    const patches: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url().includes('/api/cart/lines/')) {
        patches.push(request.postData() ?? '')
      }
    })
    const increase = line.getByRole('button', { name: `Aumentar quantidade de ${NFT.emerald.name}` })
    await increase.click()
    await increase.click()
    await increase.click()
    // The number on screen follows each click at once.
    await expect(line.getByTestId('line-quantity')).toHaveText('4')

    await expect(page.getByTestId('live-region')).toHaveText(
      `Quantidade de ${NFT.emerald.name} atualizada para 4.`,
    )
    await expect(page.getByTestId('quote-total')).toHaveText('4.776 ETH')
    expect(patches).toEqual(['{"quantity":4}'])
  })

  test('removes a line and announces it', async ({ page }) => {
    await open(page, '/')
    await signIn(page)
    await addToCart(page, NFT.emerald, 1)
    await addToCart(page, NFT.sage, 1)
    await page.goto('/carrinho')

    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await page.getByRole('button', { name: `Remover ${NFT.sage.name} do carrinho` }).click()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    await expect(page.getByTestId('live-region')).toHaveText(`${NFT.sage.name} foi removido do carrinho.`)
    await expect(page.getByTestId('quote-total')).toHaveText('1.206 ETH')

    await page.getByRole('button', { name: `Remover ${NFT.emerald.name} do carrinho` }).click()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('rejects invalid and expired Coupons inline, applies and removes a valid one', async ({ page }) => {
    await open(page, '/')
    await signIn(page)
    await addToCart(page, NFT.emerald, 2)
    await page.goto('/carrinho')

    const code = page.getByRole('textbox', { name: 'Código promocional' })
    const apply = page.getByRole('button', { name: 'Aplicar' })

    await apply.click()
    await expect(code).toHaveAccessibleDescription('Campo obrigatório.')

    await code.fill('NOPE')
    await apply.click()
    await expect(code).toHaveAccessibleDescription('Cupom inválido.')
    await expect(code).toHaveAttribute('aria-invalid', 'true')

    await code.fill('EXPIRED20')
    await apply.click()
    await expect(code).toHaveAccessibleDescription('Este cupom expirou.')

    await code.fill('kurio10')
    await apply.click()
    await expect(page.getByText('Cupom KURIO10 aplicado.').first()).toBeVisible()
    // 10% of 2.38 = 0.238; total = 2.38 − 0.238 + 0.016.
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.238 ETH')
    await expect(page.getByTestId('quote-total')).toHaveText('2.158 ETH')

    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).click()
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.00')
    await expect(page.getByTestId('quote-total')).toHaveText('2.396 ETH')
  })

  test('keeps a Collector Cart (with its Coupon) after a refresh', async ({ page }) => {
    await open(page, '/')
    await signIn(page)
    await addToCart(page, NFT.emerald, 3)
    await page.goto('/carrinho')
    await page.getByRole('textbox', { name: 'Código promocional' }).fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.357 ETH')

    await reload(page)
    await expect(
      page.getByRole('listitem', { name: NFT.emerald.name }).getByTestId('line-quantity'),
    ).toHaveText('3')
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.357 ETH')
  })

  test('keeps a Guest Cart after a refresh and after logging in', async ({ page }) => {
    await open(page, '/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    await addToCart(page, NFT.sage, 2)
    await page.goto('/carrinho')
    await reload(page)
    const line = page.getByRole('listitem', { name: NFT.sage.name })
    await expect(line.getByTestId('line-quantity')).toHaveText('2')
    // A Guest sees a Quote too.
    await expect(page.getByTestId('quote-total')).toHaveText('3.396 ETH')

    await signIn(page)
    await page.goto('/carrinho')
    await expect(page.getByRole('button', { name: /Ana Souza/ })).toBeVisible()
    await expect(page.getByRole('listitem', { name: NFT.sage.name }).getByTestId('line-quantity')).toHaveText(
      '2',
    )
  })

  test('sends a Guest who checks out to login, keeping the way back', async ({ page }) => {
    await open(page, '/carrinho')
    await addToCart(page, NFT.emerald, 1)
    await page.goto('/carrinho')
    await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
  })
})
