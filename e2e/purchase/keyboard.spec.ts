// Scenario 11 (purchase): the review dialog is operable from the keyboard and keeps focus inside.
import { expect, open, test } from '../fixtures'
import { anaWithCart } from './helpers'

test('the review dialog takes focus, traps Tab, closes on Esc and returns focus', async ({ page }) => {
  await open(page, '/')
  await anaWithCart(page, '/pagamento')
  await page.getByLabel('Código de indicação').fill('AMIGO-KURIO')
  const confirm = page.getByRole('button', { name: 'Confirmar compra' })
  await confirm.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Revise sua compra' })
  await expect(dialog).toBeVisible()
  const insideDialog = () => page.evaluate(() => Boolean(document.activeElement?.closest('[role=dialog]')))
  expect(await insideDialog()).toBe(true)
  for (let i = 0; i < 12; i++) {
    // Sequential on purpose: each Tab starts where the previous one left focus.
    // oxlint-disable-next-line no-await-in-loop
    await page.keyboard.press('Tab')
    // oxlint-disable-next-line no-await-in-loop
    expect(await insideDialog()).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(confirm).toBeFocused()
})
