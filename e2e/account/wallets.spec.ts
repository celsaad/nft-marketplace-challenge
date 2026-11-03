// Scenario 8 (Wallets): the Figma's inline forms, Buyer Details, validation, Primary moves.
import { ANA, expect, open, test } from '../fixtures'
import { loginAs } from './helpers'

const POLYGON_ADDRESS = `0x${'c0ffee'.padEnd(40, '0')}`

test.beforeEach(async ({ page }) => {
  await open(page, '/')
  await loginAs(page, ANA, 'Ana Souza')
  await page.goto('/carteiras')
  await expect(page.getByRole('heading', { name: 'Polygon', exact: true })).toBeVisible()
})

test('adds a secondary Wallet that copies the primary Buyer Details, with inline errors first', async ({
  page,
}) => {
  const secondary = page.getByRole('region', { name: 'Carteira secundária' })
  await page.getByRole('button', { name: 'Adicionar carteira secundária', exact: true }).click()
  const save = secondary.getByRole('button', { name: 'Salvar carteira', exact: true })

  await save.click()
  await expect(secondary.getByRole('textbox', { name: 'Apelido da carteira' })).toHaveAccessibleDescription(
    'Campo obrigatório.',
  )
  await expect(secondary.getByRole('combobox', { name: 'Rede' })).toHaveAccessibleDescription(
    'Campo obrigatório.',
  )

  await page.getByRole('checkbox', { name: 'Igual à carteira principal' }).check()
  await expect(secondary.getByRole('textbox', { name: 'Nome de exibição' })).toHaveValue('Ana Souza')
  await expect(secondary.getByRole('textbox', { name: 'Código de indicação' })).toHaveValue('KURIO-ANA')
  await expect(secondary.getByRole('textbox', { name: 'Nome ENS' })).toHaveValue('anasouza')

  await secondary.getByRole('textbox', { name: 'Apelido da carteira' }).fill('Cofre')
  await secondary.getByRole('combobox', { name: 'Rede' }).click()
  await page.getByRole('option', { name: 'Solana' }).click()
  await secondary.getByRole('textbox', { name: 'Endereço da carteira' }).fill(POLYGON_ADDRESS)
  await secondary.getByRole('combobox', { name: 'Tipo de carteira' }).click()
  await page.getByRole('option', { name: 'MetaMask' }).click()
  await save.click()
  await expect(secondary.getByRole('textbox', { name: 'Endereço da carteira' })).toHaveAccessibleDescription(
    /O endereço não corresponde à rede escolhida\./,
  )

  await secondary.getByRole('combobox', { name: 'Rede' }).click()
  await page.getByRole('option', { name: 'Polygon' }).click()
  await save.click()

  await expect(page.getByText('Carteira salva.')).toBeVisible()
  const card = secondary.getByRole('article', { name: 'Cofre' })
  await expect(card).toContainText('0xc0ff…0000')
  await expect(card).toContainText('MetaMask')

  await page.reload()
  await page.getByRole('button', { name: 'Editar Cofre', exact: true }).click()
  const saved = page.getByRole('article', { name: 'Cofre' })
  await expect(saved.getByRole('textbox', { name: 'Nome do perfil' })).toHaveValue('Ana Coleções')
  await expect(saved.getByRole('textbox', { name: 'E-mail' })).toHaveValue('ana@jungle.test')
})

test('edits the primary Wallet inline and moves Primary to a secondary one', async ({ page }) => {
  const primary = page.getByRole('region', { name: 'Carteira principal' })
  await primary.getByRole('textbox', { name: 'Apelido da carteira' }).fill('Principal diária')
  await primary.getByRole('button', { name: 'Salvar carteira', exact: true }).click()
  await expect(page.getByText('Carteira salva.')).toBeVisible()
  await page.reload()
  await expect(primary.getByRole('textbox', { name: 'Apelido da carteira' })).toHaveValue('Principal diária')

  await page.getByRole('button', { name: 'Tornar Polygon a carteira principal', exact: true }).click()
  await expect(primary.getByRole('textbox', { name: 'Apelido da carteira' })).toHaveValue('Polygon')
  const secondary = page.getByRole('region', { name: 'Carteira secundária' })
  await expect(secondary.getByRole('article', { name: 'Principal diária' })).toBeVisible()
})
