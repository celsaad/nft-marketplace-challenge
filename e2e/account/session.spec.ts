// Scenario 3: sign-up, login, Session Expiry, logout and switching Collectors.
import { ANA, BRUNO, expect, open, test } from '../fixtures'
import { accountMenu, fillLogin, loginAs, logoutVia } from './helpers'

const createButton = /^Criar (conta|perfil)$/

test.describe('Sign-up', () => {
  test('creates an account and returns to the flow it came from', async ({ page }) => {
    await open(page, '/cadastro?redirect=/carteiras')
    await page.getByRole('textbox', { name: 'Nome de usuário', exact: true }).fill('carla_nunes')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('carla@jungle.test')
    await page.getByLabel('Senha', { exact: true }).fill('Segura123')
    await page.getByLabel('Confirmar senha', { exact: true }).fill('Segura123')
    await page.getByRole('button', { name: createButton }).click()

    await expect(page).toHaveURL(/\/carteiras$/)
    await expect(accountMenu(page, 'carla_nunes')).toBeVisible()
    await expect(page.getByText('Você ainda não adicionou uma carteira principal.')).toBeVisible()
  })

  test('validates locally and puts API conflicts on the right field', async ({ page }) => {
    await open(page, '/cadastro')
    await page.getByRole('textbox', { name: 'Nome de usuário', exact: true }).fill('ana_souza')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('nova@jungle.test')
    await page.getByLabel('Senha', { exact: true }).fill('Segura123')
    await page.getByLabel('Confirmar senha', { exact: true }).fill('Outra123')
    await page.getByRole('button', { name: createButton }).click()
    await expect(page.getByLabel('Confirmar senha', { exact: true })).toHaveAccessibleDescription(
      'As senhas não coincidem.',
    )

    await page.getByLabel('Confirmar senha', { exact: true }).fill('Segura123')
    await page.getByRole('button', { name: createButton }).click()
    const username = page.getByRole('textbox', { name: 'Nome de usuário', exact: true })
    await expect(username).toHaveAccessibleDescription('Este nome de usuário já está em uso.')
    await expect(username).toBeFocused()

    await username.fill('nova_pessoa')
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(ANA.email)
    await page.getByRole('button', { name: createButton }).click()
    await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveAccessibleDescription(
      'Este e-mail já está cadastrado.',
    )
    await expect(page).toHaveURL(/\/cadastro/)
  })
})

test.describe('Login', () => {
  test('rejects wrong credentials without saying which one was wrong', async ({ page }) => {
    await open(page, '/entrar')
    await fillLogin(page, { email: ANA.email, password: 'errada123' })
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
    await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('asks a Guest to log in for a private screen and returns there afterwards', async ({ page }) => {
    await open(page, '/perfil')
    await expect(page).toHaveURL(/\/entrar\?.*redirect=%2Fperfil/)
    await expect(page.getByText('Entre na sua conta para continuar.')).toBeVisible()
    await fillLogin(page, ANA)
    await expect(page).toHaveURL(/\/perfil(\?|$)/)
    await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true })).toHaveValue(
      'Ana Souza',
    )
  })

  test('keeps the Session after a refresh and sends a signed-in Collector away from /entrar', async ({
    page,
  }) => {
    await open(page, '/')
    await loginAs(page, ANA, 'Ana Souza')
    await page.reload()
    await expect(accountMenu(page, 'Ana Souza')).toBeVisible()
    await page.goto('/entrar?redirect=/carteiras')
    await expect(page).toHaveURL(/\/carteiras$/)
  })
})

test.describe('Session lifecycle', () => {
  test('Session Expiry on /perfil sends to login and back to /perfil', async ({ page, mock }) => {
    await open(page, '/')
    await loginAs(page, ANA, 'Ana Souza')
    // /perfil also loads the Cart (header badge) and the Wallets. Expiring the Session while one
    // of them is still in flight makes *that* request the one that meets the 401, before Salvar.
    const backgroundLoads = Promise.all(
      ['/api/cart', '/api/wallets'].map((path) =>
        page.waitForResponse((r) => new URL(r.url()).pathname === path),
      ),
    )
    await page.goto('/perfil')
    await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true })).toHaveValue(
      'Ana Souza',
    )
    await backgroundLoads

    await mock.expireSession()
    await page.getByRole('textbox', { name: 'Nome de exibição', exact: true }).fill('Ana S.')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    await expect(page).toHaveURL(/\/entrar\?/)
    expect(new URL(page.url()).searchParams.get('reason')).toBe('expired')
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/perfil')
    await expect(page.locator('main').getByText(/Sua sessão expirou/)).toBeVisible()

    await fillLogin(page, ANA)
    await expect(page).toHaveURL(/\/perfil$/)
    // The edit never reached the server, so the profile is unchanged.
    await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true })).toHaveValue(
      'Ana Souza',
    )
  })

  test('logout ends the Session and private screens need a login again', async ({ page }) => {
    await open(page, '/')
    await loginAs(page, ANA, 'Ana Souza')
    await logoutVia(page, 'Ana Souza')
    await page.reload()
    await expect(accountMenu(page, 'Ana Souza')).toHaveCount(0)
    await page.goto('/carteiras')
    await expect(page).toHaveURL(/\/entrar\?.*reason=required/)
  })

  test('switching Collectors never shows the previous one’s private data', async ({ page }) => {
    await open(page, '/')
    await loginAs(page, ANA, 'Ana Souza')
    await page.goto('/carteiras')
    await expect(page.getByText('0xa11c…0000').first()).toBeVisible()
    await page.goto('/perfil')
    await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true })).toHaveValue(
      'Ana Souza',
    )

    await logoutVia(page, 'Ana Souza')
    await loginAs(page, BRUNO, 'Bruno Lima')
    await page.goto('/carteiras')
    await expect(page.getByRole('heading', { name: 'Solana' })).toBeVisible()
    await expect(page.getByText(/0xa11c/)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Polygon' })).toHaveCount(0)

    await page.goto('/perfil')
    await expect(page.getByRole('textbox', { name: 'Nome de exibição', exact: true })).toHaveValue(
      'Bruno Lima',
    )
    await expect(page.locator('main').getByText('Ana Souza')).toHaveCount(0)
  })
})
