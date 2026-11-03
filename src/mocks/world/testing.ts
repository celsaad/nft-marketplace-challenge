// Test doubles for the World's injected dependencies (used by Vitest only).
import type { Clock, IdSource, KeyValueStore } from './deps'
import { createWorld } from './world'

export function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  }
}

export function fakeClock(start = Date.parse('2026-11-03T12:00:00Z')): Clock & { advance(ms: number): void } {
  let now = start
  let timers: { at: number; fn: () => void; id: number }[] = []
  let nextId = 1
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId++
      timers.push({ at: now + ms, fn, id })
      return id
    },
    clearTimeout(id) {
      timers = timers.filter((t) => t.id !== id)
    },
    advance(ms) {
      now += ms
      const due = timers.filter((t) => t.at <= now).toSorted((a, b) => a.at - b.at)
      timers = timers.filter((t) => t.at > now)
      for (const t of due) t.fn()
    },
  }
}

export function sequentialIds(): IdSource {
  let n = 0
  return { next: (prefix) => `${prefix}_${++n}` }
}

export async function testWorld(options?: Parameters<typeof createWorld>[1]) {
  const clock = fakeClock()
  const storage = memoryStore()
  const world = await createWorld({ storage, clock, ids: sequentialIds() }, options)
  const events: Parameters<Parameters<typeof world.subscribe>[0]>[0][] = []
  world.subscribe((e) => events.push(e))
  return { world, clock, storage, events }
}

/** Unwraps a successful Result or fails the test with the domain error. */
export function ok<T>(result: { ok: true; value: T } | { ok: false; error: { code: string } }): T {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}`)
  return result.value
}

export const ANA = { email: 'ana@jungle.test', password: 'Password123!' }
export const BRUNO = { email: 'bruno@jungle.test', password: 'Password123!' }
