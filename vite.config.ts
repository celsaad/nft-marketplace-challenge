import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const EAGER_VENDOR =
  /node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:react|react-dom|scheduler|@tanstack[\\/](?:react-router|router-core|history|query-core|react-query|react-store|store)|axios|zod|zustand|tailwind-merge|clsx|class-variance-authority)[\\/]/

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      // Only MSW's cookie handling uses it; see the stub for why that is safe here.
      tldts: new URL('./src/mocks/tldts-stub.ts', import.meta.url).pathname,
    },
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Libraries every page needs before its first paint, in one file instead of ~15 small
          // ones: fewer requests on the critical path (docs/lighthouse/improvement-research.md §2).
          // Only always-eager packages belong here; route-only ones (Radix slider, tabs…) stay split.
          groups: [{ name: 'vendor', test: EAGER_VENDOR, priority: 10 }],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
