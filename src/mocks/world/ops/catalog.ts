// Catalog reads, Favorites, and the NFT helpers other modules use (Editions, publishing changes).

import { queryCatalog, toDetail } from '../catalog-query'
import { authenticate, type Core, nowIso } from '../core'
import { fail, succeed } from '../result'
import type { NftRecord } from '../state'
import type { Handlers, OpName } from '../types'

export function findEdition(core: Core, nftId: string, editionId: string) {
  const nft = core.state.nfts[nftId]
  const edition = nft?.editions.find((e) => e.id === editionId)
  return nft && edition ? { nft, edition } : null
}

export const maxQuantity = (nft: NftRecord, available: number) => Math.min(available, nft.maxPerOrder)

/** Bumps an NFT's version and tells everyone its new Price and Availability. */
export function publishNft(core: Core, nft: NftRecord) {
  nft.version++
  core.emit(
    {
      type: 'nft.updated',
      eventId: core.ids.next('evt'),
      resourceId: nft.id,
      version: nft.version,
      occurredAt: nowIso(core),
      userId: null,
      payload: {
        price: nft.price,
        previousPrice: nft.previousPrice,
        editions: nft.editions.map((e) => ({ id: e.id, available: e.available })),
        soldOut: nft.editions.every((e) => e.available === 0),
      },
    },
    'all',
  )
}

/** Publishes each distinct NFT once (after a batch of Edition changes). */
export function publishNfts(core: Core, nftIds: Iterable<string>) {
  for (const nftId of new Set(nftIds)) {
    const nft = core.state.nfts[nftId]
    if (nft) publishNft(core, nft)
  }
}

const REVIEW_AUTHORS = ['Marina C.', 'Diego R.', 'Lia M.', 'Tomás A.', 'Rafa P.', 'Júlia N.']
const REVIEW_TEXTS = [
  'Arte impecável e procedência clara. Recomendo.',
  'Detalhes lindos em alta resolução; valeu cada ETH.',
  'Entrega instantânea e edição bem documentada.',
  'Coleção consistente, criador muito ativo na comunidade.',
  'Gostei, mas esperava mais atributos raros.',
  'Uma das peças favoritas da minha carteira.',
]

export const catalogHandlers = {
  async 'catalog.list'(core, query) {
    return succeed(queryCatalog(Object.values(core.state.nfts), query))
  },

  async 'catalog.get'(core, { id }) {
    const nft = core.state.nfts[id]
    return nft ? succeed(toDetail(nft)) : fail('NOT_FOUND', 'NFT not found')
  },

  async 'catalog.reviews'(core, { id }) {
    const nft = core.state.nfts[id]
    if (!nft) return fail('NOT_FOUND', 'NFT not found')
    const listed = Date.parse(nft.listedAt)
    return succeed(
      REVIEW_AUTHORS.slice(0, Math.min(REVIEW_AUTHORS.length, nft.rating.count)).map((author, i) => ({
        id: `rev_${nft.id}_${i}`,
        author,
        rating: i === 4 ? 4 : 5,
        text: REVIEW_TEXTS[i] as string,
        createdAt: new Date(listed + (i + 1) * 3_600_000).toISOString(),
      })),
    )
  },

  async 'favorites.list'(core, _input, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    return succeed(core.state.favorites[auth.value.id] ?? [])
  },

  async 'favorites.add'(core, { nftId }, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    if (!core.state.nfts[nftId]) return fail('NOT_FOUND', 'NFT not found')
    const current = (core.state.favorites[auth.value.id] ?? []).filter((id) => id !== nftId)
    core.state.favorites[auth.value.id] = [nftId, ...current]
    return succeed(core.state.favorites[auth.value.id] as string[])
  },

  async 'favorites.remove'(core, { nftId }, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    const id = auth.value.id
    core.state.favorites[id] = (core.state.favorites[id] ?? []).filter((favorite) => favorite !== nftId)
    return succeed(core.state.favorites[id] as string[])
  },
} satisfies Partial<Handlers<OpName>>
