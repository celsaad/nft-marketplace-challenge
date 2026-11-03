// Runtime configuration from Vite env (see .env.example). Defaults keep a clean checkout working.
export const config = {
  mocksEnabled: (import.meta.env.VITE_MOCKS ?? 'on') === 'on',
  apiBase: import.meta.env.VITE_API_URL ?? '/api',
  realtimeUrl: import.meta.env.VITE_REALTIME_URL ?? 'wss://realtime.kurio.test',
} as const
