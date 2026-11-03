// Deterministic seed data. Credentials are fictional and documented in the README.
import { eth } from '@/lib/money/eth'
import { seedCatalog } from './catalog-fixtures'
import { hashPassword } from './password'
import type { CollectorRecord, WalletRecord, WorldState } from './state'

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
    wallets: Object.fromEntries(
      [
        wallet(
          'w_ana_main',
          ana.id,
          'Principal',
          `0x${'a11ce'.padEnd(40, '0')}`,
          'ethereum',
          'metamask',
          true,
        ),
        wallet(
          'w_ana_poly',
          ana.id,
          'Polygon',
          `0x${'a11ce2'.padEnd(40, '0')}`,
          'polygon',
          'coinbase',
          false,
        ),
        wallet(
          'w_bruno_main',
          bruno.id,
          'Principal',
          `0x${'b2a0'.padEnd(40, '0')}`,
          'ethereum',
          'coinbase',
          true,
        ),
        wallet(
          'w_bruno_sol',
          bruno.id,
          'Solana',
          'BRuNo1111111111111111111111111111111111111',
          'solana',
          'walletconnect',
          false,
        ),
      ].map((w) => [w.id, w]),
    ),
    walletConnections: {},
    orders: {},
    idempotency: {},
    behavior: { walletResponse: 'approve', paymentOutcome: 'confirm' },
  }
}

function wallet(
  id: string,
  ownerId: string,
  label: string,
  address: string,
  network: WalletRecord['network'],
  provider: WalletRecord['provider'],
  isPrimary: boolean,
): WalletRecord {
  return { id, ownerId, label, address, network, provider, isPrimary, createdAt: '2026-10-01T12:00:00.000Z' }
}
