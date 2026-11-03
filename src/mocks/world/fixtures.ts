// Deterministic seed data. Credentials are fictional and documented in the README.
import { eth } from '@/lib/money/eth'
import { seedCatalog } from './catalog-fixtures'
import { hashPassword } from './password'
import type { CollectorRecord, WorldState } from './state'

export const FIXTURE_PASSWORD = 'Password123!'

async function collector(
  fields: Omit<CollectorRecord, 'passwordSalt' | 'passwordHash'>,
): Promise<CollectorRecord> {
  const passwordSalt = `salt-${fields.id}`
  return { ...fields, passwordSalt, passwordHash: await hashPassword(FIXTURE_PASSWORD, passwordSalt) }
}

export async function seedState(): Promise<WorldState> {
  const ana = await collector({
    id: 'col_ana',
    email: 'ana@jungle.test',
    displayName: 'Ana Souza',
    username: 'ana_souza',
    avatarUrl: null,
    ensName: 'anasouza.eth',
    bio: 'Coleciono arte generativa e retratos digitais.',
  })
  const bruno = await collector({
    id: 'col_bruno',
    email: 'bruno@jungle.test',
    displayName: 'Bruno Lima',
    username: 'bruno_lima',
    avatarUrl: null,
    ensName: 'brunolima.eth',
    bio: 'Fã de música on-chain e edições abertas.',
  })
  return {
    collectors: { [ana.id]: ana, [bruno.id]: bruno },
    sessions: {},
    nfts: seedCatalog(),
    favorites: {},
    carts: {},
    coupons: {
      KURIO10: { code: 'KURIO10', kind: 'percent', value: '1000', minSubtotal: null, expiresAt: null },
      LAUNCH05: { code: 'LAUNCH05', kind: 'fixed', value: '0.05', minSubtotal: eth('1'), expiresAt: null },
      EXPIRED20: {
        code: 'EXPIRED20',
        kind: 'percent',
        value: '2000',
        minSubtotal: null,
        expiresAt: Date.parse('2026-01-01T00:00:00Z'),
      },
    },
    quotes: {},
  }
}
