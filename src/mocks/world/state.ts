import type { Collector } from '@/contracts/account'

export interface CollectorRecord extends Collector {
  passwordSalt: string
  passwordHash: string
}

export interface SessionRecord {
  collectorId: string
  expiresAt: number
}

/** The whole mock database. Plain JSON so it can be saved to storage as-is. */
export interface WorldState {
  collectors: Record<string, CollectorRecord>
  sessions: Record<string, SessionRecord>
}

export const SESSION_TTL_MS = 30 * 60 * 1000
