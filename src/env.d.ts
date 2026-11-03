/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "on" boots the MSW mock backend before the app renders. */
  readonly VITE_MOCKS?: string
  readonly VITE_API_URL?: string
  readonly VITE_REALTIME_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
