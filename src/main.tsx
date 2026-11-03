import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { config } from './app/config'
import { routeTree } from './routeTree.gen'
import './styles.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

async function boot() {
  // The one place that knows the mock backend exists (ADR 0001). It must be running before the
  // first request and before socket.io-client is loaded, or that client captures the real WebSocket.
  if (config.mocksEnabled) {
    const { startMocks } = await import('./mocks/start')
    await startMocks({ apiBase: config.apiBase, realtimeUrl: config.realtimeUrl })
  }

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

void boot()
