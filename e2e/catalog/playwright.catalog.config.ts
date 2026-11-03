// The shared Playwright config on its own port, for running only the catalog specs while other
// worktrees may be serving their own build on 4173 (reuseExistingServer would pick theirs up).
// Same testDir and snapshot template, so baselines are shared with `pnpm e2e -- e2e/catalog`.
// Usage: corepack pnpm exec playwright test -c e2e/catalog/playwright.catalog.config.ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import base from '../../playwright.config'

const PORT = Number(process.env.CATALOG_E2E_PORT ?? 4311)
const root = fileURLToPath(new URL('../..', import.meta.url))
const vite = 'node ./node_modules/vite/bin/vite.js'

export default defineConfig({
  ...base,
  testDir: '..',
  testMatch: 'catalog/**/*.spec.ts',
  outputDir: `${root}/test-results`,
  reporter: [['list']],
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `${vite} build && ${vite} preview --port ${PORT} --strictPort`,
    cwd: root,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
