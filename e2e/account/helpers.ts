// Account flows through the UI only, as a Collector would do them.
import { crc32, deflateSync } from 'node:zlib'
import type { Page } from '@playwright/test'
import { expect, fillLogin } from '../fixtures'

export { fillLogin }

/** Logs in from /entrar and waits until the header shows the Collector. */
export async function loginAs(page: Page, credentials: { email: string; password: string }, name: string) {
  await page.goto('/entrar')
  await fillLogin(page, credentials)
  await expect(accountMenu(page, name)).toBeVisible()
}

export const accountMenu = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

export async function logoutVia(page: Page, name: string) {
  await accountMenu(page, name).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible()
}

function pngChunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

/** A solid-colour PNG built in memory, so the avatar test needs no fixture file. */
export function makePng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, Buffer.from([210, 138, 76]))])
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', pixels),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
