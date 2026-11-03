// Scenario 11 (account): keyboard-only login and Wallet dialog, errors tied to their fields.
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

test('operates the Wallet dialog from the keyboard: trapped focus, Esc, focus back on the trigger', async ({
  page,
}) => {
  await open(page, '/')
  await loginAs(page, ANA, 'Ana Souza')
  await page.goto('/carteiras')

  const add = page.getByRole('button', { name: 'Adicionar carteira principal', exact: true })
  await add.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Adicionar carteira' })
  await expect(dialog).toBeVisible()
  const label = dialog.getByRole('textbox', { name: 'Apelido da carteira' })
  await expect(label).toBeFocused()

  // Tab cycles inside the dialog and never reaches the page behind it.
  for (let i = 0; i < 12; i++) {
    // Sequential on purpose: each Tab depends on where the previous one left focus.
    // oxlint-disable-next-line no-await-in-loop
    await page.keyboard.press('Tab')
    // oxlint-disable-next-line no-await-in-loop
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }

  // Enter in a field submits: errors appear on the fields.
  await label.focus()
  await page.keyboard.press('Enter')
  await expect(label).toHaveAccessibleDescription('Campo obrigatório.')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(add).toBeFocused()

  // Editing returns focus to that Wallet's own Edit button.
  const edit = page.getByRole('button', { name: 'Editar Polygon', exact: true })
  await edit.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Editar carteira' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(edit).toBeFocused()
})
