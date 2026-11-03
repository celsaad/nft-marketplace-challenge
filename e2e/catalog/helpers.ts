// Helpers for the catalog specs. They read the UI the way a person does (roles, names, text).
// UI steps (clicks, key presses, queued failures) must happen in order.
/* oxlint-disable no-await-in-loop */
import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect } from '../fixtures'

export const isMobile = (info: TestInfo) => info.project.name === 'mobile'

export const cards = (page: Page) => page.getByTestId('nft-card')

export const cardNames = (page: Page) => cards(page).getByRole('heading').allInnerTexts()

export const card = (page: Page, name: string) => cards(page).filter({ hasText: name })

/** A search param as the app wrote it (arrays are JSON, e.g. ["music"]). */
export function param(page: Page, name: string): string | null {
  return new URL(page.url()).searchParams.get(name)
}

export const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Buscar NFTs' })

/**
 * Toggles Categories/Networks the way each layout offers it: the desktop sidebar applies each
 * click; on mobile the filter Sheet keeps a draft until "Aplicar".
 */
export async function chooseFilters(page: Page, info: TestInfo, options: string[]) {
  if (!isMobile(info)) {
    const sidebar = page.getByRole('region', { name: 'Filtros' })
    for (const option of options) {
      const button = sidebar.getByRole('button', { name: new RegExp(`^${option}`) })
      await button.click()
      await expect(button).toHaveAttribute('aria-pressed', 'true')
    }
    return
  }
  await page.getByRole('button', { name: /^Abrir filtros/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Filtros' })
  for (const option of options) {
    await sheet.getByRole('button', { name: new RegExp(`^${option}`) }).click()
  }
  await sheet.getByRole('button', { name: 'Aplicar' }).click()
  await expect(sheet).toBeHidden()
}

/** Whether a filter option shows as chosen (opening the mobile Sheet to look, then closing it). */
export async function expectChosen(page: Page, info: TestInfo, option: string) {
  let scope: Locator = page.getByRole('region', { name: 'Filtros' })
  if (isMobile(info)) {
    await page.getByRole('button', { name: /^Abrir filtros/ }).click()
    scope = page.getByRole('dialog', { name: 'Filtros' })
  }
  await expect(scope.getByRole('button', { name: new RegExp(`^${option}`) })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  if (isMobile(info)) {
    await page.keyboard.press('Escape')
    await expect(scope).toBeHidden()
  }
}

/** Scrolls through the page so lazy images load, then waits until every image has decoded. */
export async function settleImages(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 50))
    }
    window.scrollTo(0, 0)
  })
  // Only images that can be seen: lazy ones hidden at this breakpoint or parked beside a
  // carousel never load, by design.
  await page.waitForFunction(() =>
    Array.from(document.images).every((img) => {
      const box = img.getBoundingClientRect()
      const onScreen = box.width > 0 && box.right > 0 && box.left < window.innerWidth
      return !onScreen || (img.complete && img.naturalWidth > 0)
    }),
  )
}
