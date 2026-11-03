// Scenario 11 (account): keyboard-only login and Wallet forms, errors tied to their fields.
import { ANA, expect, open, test } from '../fixtures'
import { loginAs } from './helpers'

test('logs in with the keyboard only, reading errors from the fields', async ({ page }) => {
  await open(page, '/entrar?redirect=/carteiras')
  const email = page.getByRole('textbox', { name: 'E-mail', exact: true })
  const password = page.getByLabel('Senha', { exact: true })

  await email.focus()
  await page.keyboard.press('Enter')
  await expect(email).toHaveAccessibleDescription('Informe um e-mail válido.')
  await expect(password).toHaveAccessibleDescription('Campo obrigatório.')
  await expect(email).toBeFocused()

  await page.keyboard.type(ANA.email)
  await page.keyboard.press('Tab')
  await expect(password).toBeFocused()
  await page.keyboard.type(ANA.password)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Mostrar senha', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Esqueceu a senha?', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/carteiras$/)
})

test('operates the Wallet forms from the keyboard: Figma field order, Enter submits, Editar expands', async ({
  page,
}) => {
  await open(page, '/')
  await loginAs(page, ANA, 'Ana Souza')
  await page.goto('/carteiras')

  // Tab walks the primary form row by row, as the Figma lays it out.
  const primary = page.getByRole('region', { name: 'Carteira principal' })
  const order = ['Nome de exibição', 'Apelido da carteira', 'Rede', 'Nome do perfil', 'Endereço da carteira']
  await primary.getByRole('textbox', { name: 'Nome de exibição' }).focus()
  for (const name of order.slice(1)) {
    // Sequential on purpose: each Tab depends on where the previous one left focus.
    // oxlint-disable-next-line no-await-in-loop
    await page.keyboard.press('Tab')
    // oxlint-disable-next-line no-await-in-loop
    expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid'))).toBeNull()
    // oxlint-disable-next-line no-await-in-loop
    await expect(
      primary.getByRole(name === 'Rede' ? 'combobox' : 'textbox', { name, exact: true }),
    ).toBeFocused()
  }

  // Enter in any field submits; an emptied required field is announced with its error.
  const label = primary.getByRole('textbox', { name: 'Apelido da carteira' })
  await label.fill('')
  await primary.getByRole('textbox', { name: 'Nome do perfil' }).press('Enter')
  await expect(label).toHaveAccessibleDescription('Campo obrigatório.')
  // The form moves focus to the first invalid field (just after rendering the error).
  await expect(label).toBeFocused()
  // react-hook-form focuses it again from a setTimeout; let that run before moving focus on.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)))

  // A secondary Wallet's Editar is a disclosure: it reports its state and keeps focus.
  const edit = page.getByRole('button', { name: 'Editar Polygon', exact: true })
  await edit.focus()
  await page.keyboard.press('Enter')
  const close = page.getByRole('button', { name: 'Fechar edição', exact: true })
  await expect(close).toHaveAttribute('aria-expanded', 'true')
  await expect(close).toBeFocused()
})
