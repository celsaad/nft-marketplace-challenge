// Scenario 2: direct access to an NFT's detail, a nonexistent NFT, an unavailable Edition and the
// quantity limit.
import { expect, open, test } from '../fixtures'
import { card } from './helpers'

const EMERALD = '/nft/nft_emerald-ape-042'
const edition = (size: string) => `ed_emerald-ape-042_${size}`

test.describe('NFT detail', () => {
  test('opens directly from its address and survives a refresh', async ({ page }) => {
    await open(page, EMERALD)
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByText('1.19 ETH').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Edição:' }).getByRole('radio')).toHaveCount(4)
    await expect(page.getByText('Coleção:').first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })

  test('is reached from a catalog card', async ({ page }) => {
    await open(page, '/')
    await card(page, 'Sage Nomad #009').getByRole('link').click()
    await expect(page).toHaveURL(/\/nft\/nft_sage-nomad-009/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sage Nomad #009' })).toBeVisible()
  })

  test('answers a nonexistent NFT with a not-found state and a way back', async ({ page }) => {
    await open(page, '/nft/nft_nao-existe-000')
    await expect(page.getByRole('heading', { level: 1, name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao mercado' }).click()
    await expect(page).toHaveURL(/\/(\?.*)?#mercado$/)
  })

  test('limits the quantity by Availability and by the per-order limit', async ({ page, mock }) => {
    await open(page, EMERALD)
    await mock.setAvailability(edition('10'), 3)
    const radios = page.getByRole('radiogroup', { name: 'Edição:' })
    const increase = page.getByRole('button', { name: 'Aumentar quantidade' })
    const quantity = page.getByTestId('quantity')

    await radios.getByRole('radio', { name: '1/10' }).click()
    await expect(page.getByText('3 disponíveis nesta edição')).toBeVisible()
    await increase.click()
    await increase.click()
    await expect(quantity).toHaveText('3')
    await expect(increase).toBeDisabled()
    await expect(page.getByText('Apenas 3 disponíveis nesta edição.')).toBeVisible()

    // The Open Edition is capped only by the per-order limit (10); the quantity chosen so far stays.
    await radios.getByRole('radio', { name: 'ABERTA' }).click()
    await expect(quantity).toHaveText('3')
    // oxlint-disable-next-line no-await-in-loop -- clicks are sequential by nature
    for (let i = 0; i < 7; i++) await increase.click()
    await expect(quantity).toHaveText('10')
    await expect(increase).toBeDisabled()
    await expect(page.getByText('Máximo de 10 por pedido.')).toBeVisible()
  })

  test('an Edition that sells out live is disabled with the reason, and buying is blocked', async ({
    page,
    mock,
  }) => {
    await open(page, EMERALD)
    await mock.setAvailability(edition('50'), 5)
    const radio = page.getByRole('radio', { name: '1/50' })
    await radio.click()
    await expect(radio).toBeChecked()

    await mock.setAvailability(edition('50'), 0)
    await expect(radio).toBeDisabled()
    await expect(page.getByText('1/50: esgotada')).toBeVisible()
    await expect(page.getByText('Esta edição esgotou. Escolha outra edição.')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Comprar/ }).filter({ visible: true })).toBeDisabled()
  })

  test('follows a realtime price change', async ({ page, mock }) => {
    await open(page, EMERALD)
    await expect(page.getByText('1.19 ETH').filter({ visible: true }).first()).toBeVisible()
    await mock.changePrice('nft_emerald-ape-042', '0.99')
    await expect(page.getByText('0.99 ETH').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByText('O preço de Emerald Ape #042 mudou para 0.99 ETH.')).toBeAttached()
  })

  test('adds the chosen Edition and quantity to the Cart', async ({ page, mock }) => {
    await open(page, EMERALD)
    await mock.setAvailability(edition('10'), 4)
    await page.getByRole('radio', { name: '1/10' }).click()
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await page
      .getByRole('button', { name: /^Comprar/ })
      .filter({ visible: true })
      .click()
    await expect(page.getByText('2× Emerald Ape #042 (1/10) no carrinho.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ver carrinho' })).toBeVisible()
  })
})
