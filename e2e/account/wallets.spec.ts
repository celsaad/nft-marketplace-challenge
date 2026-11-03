// Scenario 8 (Wallets): create and edit through the dialog, inline validation, Primary moves.
import { ANA, expect, open, test } from '../fixtures'
import { loginAs } from './helpers'

const POLYGON_ADDRESS = `0x${'c0ffee'.padEnd(40, '0')}`

test.beforeEach(async ({ page }) => {
  await open(page, '/')
  await loginAs(page, ANA, 'Ana Souza')
  await page.goto('/carteiras')
  await expect(page.getByRole('heading', { name: 'Polygon', exact: true })).toBeVisible()
})

test('creates a secondary Wallet, with inline errors for a missing field and a wrong-network address', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Adicionar carteira secundária', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Adicionar carteira' })
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Apelido da carteira' })).toHaveAccessibleDescription(
    'Campo obrigatório.',
  )
  await expect(dialog.getByRole('combobox', { name: 'Rede' })).toHaveAccessibleDescription(
    'Campo obrigatório.',
  )

  await dialog.getByRole('textbox', { name: 'Apelido da carteira' }).fill('Cofre')
  await dialog.getByRole('combobox', { name: 'Rede' }).click()
  await page.getByRole('option', { name: 'Solana' }).click()
  await dialog.getByRole('textbox', { name: 'Endereço da carteira' }).fill(POLYGON_ADDRESS)
  await dialog.getByRole('combobox', { name: 'Tipo de carteira' }).click()
  await page.getByRole('option', { name: 'MetaMask' }).click()
  await dialog.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(dialog.getByRole('textbox', { name: 'Endereço da carteira' })).toHaveAccessibleDescription(
    /O endereço não corresponde à rede escolhida\./,
  )

  await dialog.getByRole('combobox', { name: 'Rede' }).click()
  await page.getByRole('option', { name: 'Polygon' }).click()
  await dialog.getByRole('button', { name: 'Salvar carteira', exact: true }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('Carteira salva.')).toBeVisible()
  const card = page.getByRole('article', { name: 'Cofre' })
  await expect(card).toContainText('0xc0ff…0000')
  await expect(card).toContainText('MetaMask')

  await page.reload()
  await expect(page.getByRole('article', { name: 'Cofre' })).toBeVisible()
})

test('edits a Wallet and moves the Primary badge', async ({ page }) => {
  await page.getByRole('button', { name: 'Editar Polygon', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar carteira' })
  await dialog.getByRole('textbox', { name: 'Apelido da carteira' }).fill('Polygon diária')
  await dialog.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(dialog).toBeHidden()

  const primary = page.getByRole('region', { name: 'Carteira principal' })
  const secondary = page.getByRole('region', { name: 'Carteira secundária' })
  await expect(secondary.getByRole('article', { name: 'Polygon diária' })).toBeVisible()

  await page.getByRole('button', { name: 'Tornar Polygon diária a carteira principal', exact: true }).click()
  await expect(primary.getByRole('article', { name: 'Polygon diária' })).toContainText('Principal')
  await expect(secondary.getByRole('article', { name: 'Principal' })).toBeVisible()

  await page.reload()
  await expect(primary.getByRole('article', { name: 'Polygon diária' })).toBeVisible()
})
