// Deterministic seed data. Credentials are fictional and documented in the README.
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
  }
}
