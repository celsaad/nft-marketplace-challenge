// Simulated network conditions, applied around every REST call. Randomness is seeded so a
// Scenario behaves the same way on every run.
import type { NetworkProfile } from '../world/scenarios'
import type { OpName } from '../world/world'

/** One-shot failures queued from the Mock Lab or Playwright, consumed by the next matching call. */
export type Failure = 'http500' | 'http503' | 'timeout' | 'offline' | 'drop'

export interface Network {
  readonly profile: NetworkProfile
  setProfile(profile: Partial<NetworkProfile>): void
  failNext(op: OpName | '*', failure: Failure): void
  /** The queued failure for this call, if any (removed once taken). */
  takeFailure(op: OpName): Failure | null
  latency(): number
  shouldFail(): boolean
  /** True the first time an Idempotency-Key is seen; later retries of it get their response. */
  firstAttempt(key: string): boolean
}

function prng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createNetwork(initial: NetworkProfile, seed = 7): Network {
  let profile = { ...initial }
  const random = prng(seed)
  const queue: { op: OpName | '*'; failure: Failure }[] = []
  const seenKeys = new Set<string>()

  return {
    get profile() {
      return profile
    },
    setProfile(next) {
      profile = { ...profile, ...next }
    },
    failNext(op, failure) {
      queue.push({ op, failure })
    },
    takeFailure(op) {
      const index = queue.findIndex((q) => q.op === op || q.op === '*')
      if (index === -1) return null
      return queue.splice(index, 1)[0]?.failure ?? null
    },
    latency() {
      const [min, max] = profile.latencyMs
      return Math.round(min + random() * (max - min))
    },
    shouldFail() {
      return profile.failureRate > 0 && random() < profile.failureRate
    },
    firstAttempt(key) {
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    },
  }
}
