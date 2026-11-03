// Scenario 1: search, combined filters, sort and pagination live in the URL and survive refresh
// and back/forward.
import { expect, open, test } from '../fixtures'
import { card, cardNames, cards, chooseFilters, expectChosen, isMobile, param, searchBox } from './helpers'

test.describe('Catalog: search, filters, sort and pagination in the URL', () => {
  test('search and combined filters narrow the results and survive a refresh', async ({ page }, info) => {
    await open(page, '/')
    await expect(card(page, 'Emerald Ape #042')).toBeVisible()

    await searchBox(page).fill('golden')
    await expect.poll(() => param(page, 'q')).toBe('golden')
    await expect(card(page, 'Golden Beat #207')).toBeVisible()
    await expect(card(page, 'Golden Signal #160')).toBeVisible()
    await expect(card(page, 'Emerald Ape #042')).toHaveCount(0)

    // Música (both golden NFTs) + Polygon (only Golden Beat): the filters combine.
    await chooseFilters(page, info, ['Música', 'Polygon'])
    await expect.poll(() => param(page, 'category')).toContain('music')
    await expect.poll(() => param(page, 'network')).toContain('polygon')
    await expect(card(page, 'Golden Beat #207')).toBeVisible()
    await expect(card(page, 'Golden Signal #160')).toHaveCount(0)
    await expect(page.getByText('1 NFT encontrado')).toBeVisible()

    await page.reload()
    await expect(searchBox(page)).toHaveValue('golden')
    await expect(card(page, 'Golden Beat #207')).toBeVisible()
    await expect(cards(page)).toHaveCount(1)
    await expectChosen(page, info, 'Música')
    await expectChosen(page, info, 'Polygon')
  })

  test('sorting reorders the results and is kept in the URL', async ({ page }) => {
    await open(page, '/')
    await expect(cards(page)).toHaveCount(9)
    await page.getByRole('combobox', { name: /Ordenar por/ }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect.poll(() => param(page, 'sort')).toBe('price-asc')

    const prices = async () =>
      (await cards(page).locator('p').allInnerTexts()).map((text) =>
        Number.parseFloat(/(\d+\.\d+) ETH/.exec(text)?.[1] ?? 'NaN'),
      )
    await expect
      .poll(async () => {
        const list = await prices()
        return list.every((price, i) => i === 0 || price >= (list[i - 1] ?? 0))
      })
      .toBe(true)

    await page.reload()
    await expect(page.getByRole('combobox', { name: /Ordenar por/ })).toContainText('Menor preço')
  })

  test('paging, a filter change resetting the page, and back/forward restoring each view', async ({
    page,
  }) => {
    await open(page, '/')
    await expect(cards(page).first()).toContainText('Emerald Ape #042')
    const firstPage = await cardNames(page)

    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect.poll(() => param(page, 'page')).toBe('2')
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    await expect(cards(page).first()).not.toContainText('Emerald Ape #042')
    const secondPage = await cardNames(page)
    expect(secondPage).not.toEqual(firstPage)

    await page.getByRole('tab', { name: 'Em alta' }).click()
    await expect.poll(() => param(page, 'tab')).toBe('trending')
    expect(param(page, 'page')).toBeNull()

    await page.goBack()
    await expect.poll(() => param(page, 'page')).toBe('2')
    await expect(page.getByRole('tab', { name: 'Todos os NFTs' })).toHaveAttribute('aria-selected', 'true')
    await expect.poll(() => cardNames(page)).toEqual(secondPage)

    await page.goBack()
    await expect.poll(() => cardNames(page)).toEqual(firstPage)

    await page.goForward()
    await expect.poll(() => cardNames(page)).toEqual(secondPage)
    await page.reload()
    await expect.poll(() => cardNames(page)).toEqual(secondPage)
  })

  test('an empty result explains itself and clears the filters', async ({ page }) => {
    await open(page, '/')
    await searchBox(page).fill('nada-com-este-nome')
    await expect(page.getByText('Nenhum NFT corresponde à sua busca')).toBeVisible()
    await page.getByRole('link', { name: 'Limpar filtros' }).click()
    await expect(searchBox(page)).toHaveValue('')
    await expect(cards(page)).toHaveCount(9)
    expect(param(page, 'q')).toBeNull()
  })

  test('the mobile filter Sheet traps focus, closes on Esc and returns focus', async ({ page }, info) => {
    test.skip(!isMobile(info), 'the Sheet is the mobile/tablet filter UI')
    await open(page, '/')
    const trigger = page.getByRole('button', { name: /^Abrir filtros/ })
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    // Key presses and clicks are sequential by nature.
    // oxlint-disable-next-line no-await-in-loop
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab')
    await expect(sheet.locator(':focus')).toHaveCount(1)

    // A draft that is not applied changes nothing.
    await sheet.getByRole('button', { name: /^Fotografia/ }).click()
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
    expect(param(page, 'category')).toBeNull()
  })
})
