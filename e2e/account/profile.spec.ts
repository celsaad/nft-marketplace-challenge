// Scenario 8 (profile): edit, avatar upload, password change.
import { ANA, expect, open, test } from '../fixtures'
import { fillLogin, loginAs, logoutVia, makePng } from './helpers'

test.beforeEach(async ({ page }) => {
  await open(page, '/')
  await loginAs(page, ANA, 'Ana Souza')
  await page.goto('/perfil')
  await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true })).toHaveValue('Ana Souza')
})

test('edits the profile and the change survives a reload', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Nome de exibição', exact: true }).fill('Ana Clara')
  await page.getByRole('textbox', { name: 'Bio', exact: true }).fill('Retratos e arte generativa.')
  await page.getByRole('textbox', { name: 'Nome ENS', exact: true }).fill('anaclara')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()

  await expect(page.getByText('Perfil atualizado.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ana Clara', exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true })).toHaveValue('Ana Clara')
  await expect(page.getByRole('textbox', { name: 'Bio', exact: true })).toHaveValue(
    'Retratos e arte generativa.',
  )
  await expect(page.getByRole('textbox', { name: 'Nome ENS', exact: true })).toHaveValue('anaclara')
})

test('shows validation and uniqueness errors on their fields', async ({ page }) => {
  const email = page.getByRole('textbox', { name: 'E-mail', exact: true })
  await email.fill('nao-e-email')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(email).toHaveAccessibleDescription('Informe um e-mail válido.')
  await expect(email).toBeFocused()

  await email.fill(ANA.email)
  const username = page.getByRole('textbox', { name: 'Nome de usuário', exact: true })
  await username.fill('bruno_lima')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(username).toHaveAccessibleDescription('Este nome de usuário já está em uso.')
})

test('uploads a large avatar, downsized in the browser, and keeps it after a reload', async ({ page }) => {
  await page
    .getByTestId('avatar-file')
    .setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: makePng(1200, 800) })
  await expect(page.getByText('Avatar atualizado.')).toBeVisible()
  const avatar = page.getByRole('img', { name: 'Avatar de Ana Souza' })
  await expect(avatar).toHaveAttribute('src', /^data:image\/(webp|jpeg);base64,/)
  // 1200×800 arrives as 256×171: the browser shrank it before upload.
  expect(await avatar.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([
    256, 171,
  ])

  await page.reload()
  await expect(page.getByRole('img', { name: 'Avatar de Ana Souza' })).toBeVisible()
})

test('rejects an avatar that is not an image', async ({ page }) => {
  await page
    .getByTestId('avatar-file')
    .setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
  await expect(page.getByRole('alert')).toHaveText('Use uma imagem PNG, JPEG ou WebP.')
})

test('changes the password: a wrong current one is refused, the new one logs in', async ({ page }) => {
  const current = page.getByLabel('Senha atual', { exact: true })
  await current.fill('errada123')
  await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha9')
  await page.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha9')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(current).toHaveAccessibleDescription('A senha atual está incorreta.')
  await expect(current).toBeFocused()

  await current.fill(ANA.password)
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Senha alterada.')).toBeVisible()
  await expect(current).toHaveValue('')

  await logoutVia(page, 'Ana Souza')
  await page.goto('/entrar')
  await fillLogin(page, ANA)
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await fillLogin(page, { email: ANA.email, password: 'NovaSenha9' })
  await expect(page.getByRole('button', { name: 'Ana Souza', exact: true })).toBeVisible()
})
