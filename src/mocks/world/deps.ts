// Everything the World needs from the outside, injected so tests control time, ids and storage.

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export interface Clock {
  now(): number
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
}

export interface IdSource {
  next(prefix: string): string
}

export interface WorldDeps {
  storage: KeyValueStore
  clock: Clock
  ids: IdSource
}

export const browserDeps = (): WorldDeps => ({
  storage: {
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key),
  },
  clock: {
    now: () => Date.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
  },
  ids: { next: (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}` },
})
