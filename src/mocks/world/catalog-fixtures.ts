// Deterministic catalog. The first 8 NFTs reproduce the Figma cards (names, prices, artwork);
// the rest use CC0 art under original names (ADR 0007). Same seed → same catalog, every time.
import type { Category } from '@/contracts/catalog'
import type { Network } from '@/contracts/common'
import { eth } from '@/lib/money/eth'
import type { NftRecord } from './state'

const DAY = 86_400_000
/** The newest fixture listing; older ones go back one day at a time. */
const NEWEST_LISTING = Date.parse('2026-11-02T12:00:00Z')

/** mulberry32: tiny seeded PRNG so fixtures are reproducible. */
function prng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Art = { image: string; alt: string }
const FIGMA_ART: Record<string, Art> = {
  emerald: { image: 'figma/emerald-ape', alt: 'Macaco de óculos redondos e jaqueta verde de colegial' },
  sage: { image: 'figma/sage-gorilla', alt: 'Gorila de chapéu verde-sálvia e moletom lilás' },
  ivory: { image: 'figma/ivory-ape', alt: 'Macaco de pelagem escura com blazer marfim e gola alta verde' },
  golden: { image: 'figma/golden-monkey', alt: 'Macaco dourado com fones de ouvido verdes' },
}

interface Seed {
  slug: string
  name: string
  tokenId: string
  art: Art
  price: string
  previousPrice?: string
  category: Category
  network: Network
  collection: { id: string; name: string }
  rare?: boolean
}

const KURIO_APES = { id: 'col_kurio-apes', name: 'Kurio Apes' }

const FIGMA_SEEDS: Seed[] = [
  {
    slug: 'emerald-ape-042',
    name: 'Emerald Ape',
    tokenId: '042',
    art: FIGMA_ART.emerald!,
    price: '1.19',
    category: 'digital-art',
    network: 'ethereum',
    collection: KURIO_APES,
  },
  {
    slug: 'sage-nomad-009',
    name: 'Sage Nomad',
    tokenId: '009',
    art: FIGMA_ART.sage!,
    price: '1.69',
    category: 'digital-art',
    network: 'ethereum',
    collection: KURIO_APES,
  },
  {
    slug: 'neon-vessel-552',
    name: 'Neon Vessel',
    tokenId: '552',
    art: FIGMA_ART.ivory!,
    price: '1.99',
    previousPrice: '2.29',
    category: 'collectibles',
    network: 'polygon',
    collection: KURIO_APES,
    rare: true,
  },
  {
    slug: 'cosmic-bloom-118',
    name: 'Cosmic Bloom',
    tokenId: '118',
    art: FIGMA_ART.sage!,
    price: '1.29',
    category: 'generative',
    network: 'ethereum',
    collection: KURIO_APES,
  },
  {
    slug: 'violet-nomad-314',
    name: 'Violet Nomad',
    tokenId: '314',
    art: FIGMA_ART.sage!,
    price: '1.39',
    category: 'digital-art',
    network: 'solana',
    collection: KURIO_APES,
  },
  {
    slug: 'ivory-baron-088',
    name: 'Ivory Baron',
    tokenId: '088',
    art: FIGMA_ART.ivory!,
    price: '1.79',
    category: '3d-art',
    network: 'ethereum',
    collection: KURIO_APES,
  },
  {
    slug: 'golden-beat-207',
    name: 'Golden Beat',
    tokenId: '207',
    art: FIGMA_ART.golden!,
    price: '0.99',
    category: 'music',
    network: 'polygon',
    collection: KURIO_APES,
  },
  {
    slug: 'golden-signal-160',
    name: 'Golden Signal',
    tokenId: '160',
    art: FIGMA_ART.golden!,
    price: '0.39',
    category: 'music',
    network: 'solana',
    collection: KURIO_APES,
  },
]

const ADJECTIVES = [
  'Amber',
  'Pixel',
  'Lunar',
  'Velvet',
  'Copper',
  'Quiet',
  'Solar',
  'Mossy',
  'Rusty',
  'Hollow',
  'Bright',
  'Dusky',
  'Coral',
  'Misty',
  'Tidal',
  'Ember',
  'Frost',
  'Cobalt',
  'Saffron',
  'Jade',
]
const NOUNS = [
  'Grove',
  'Drift',
  'Lantern',
  'Harbor',
  'Comet',
  'Meadow',
  'Signal',
  'Voyage',
  'Atlas',
  'Canopy',
  'Pebble',
  'Echo',
  'Orbit',
  'Prism',
  'Ridge',
  'Rover',
]
const COLLECTIONS = [
  { id: 'col_kurio-commons', name: 'Kurio Commons' },
  { id: 'col_pixel-parade', name: 'Pixel Parade' },
  { id: 'col_soft-glyphs', name: 'Soft Glyphs' },
]
const CATEGORY_ORDER: Category[] = [
  'digital-art',
  'photography',
  'music',
  '3d-art',
  'collectibles',
  'generative',
  'games',
  'subscriptions',
  'utility',
]
const NETWORK_ORDER: Network[] = ['ethereum', 'polygon', 'solana']
export const CC0_ART_COUNT = 24

function generatedSeeds(count: number): Seed[] {
  const rand = prng(20261103)
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)] as T
  const used = new Set<string>()
  const seeds: Seed[] = []
  for (let i = 0; seeds.length < count; i++) {
    const name = `${pick(ADJECTIVES)} ${pick(NOUNS)}`
    const tokenId = String(100 + Math.floor(rand() * 900)).padStart(3, '0')
    const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${tokenId}`
    if (used.has(slug)) continue
    used.add(slug)
    const cents = 2 + Math.floor(rand() * 1228) // 0.02 … 12.30 ETH, the Figma price range
    seeds.push({
      slug,
      name,
      tokenId,
      art: {
        image: `cc0/noun-${String((i % CC0_ART_COUNT) + 1).padStart(2, '0')}`,
        alt: `Personagem pixelado de óculos quadrados, da coleção ${name}`,
      },
      price: (cents / 100).toFixed(2),
      category: CATEGORY_ORDER[seeds.length % CATEGORY_ORDER.length] as Category,
      network: NETWORK_ORDER[Math.floor(rand() * 3)] as Network,
      collection: pick(COLLECTIONS),
      rare: rand() < 0.15,
    })
  }
  return seeds
}

function editionsFor(slug: string, index: number, rand: () => number): NftRecord['editions'] {
  const sizes: (number | null)[][] = [[1, 10, 50, null], [10, 50], [50, null], [1], [null], [10]]
  return (sizes[index % sizes.length] as (number | null)[]).map((size) => ({
    id: `ed_${slug}_${size ?? 'open'}`,
    size,
    available: size === null ? 999 : Math.max(0, Math.min(size, Math.round(size * (0.2 + rand() * 0.8)))),
  }))
}

export function seedCatalog(): Record<string, NftRecord> {
  const rand = prng(42)
  const all = [...FIGMA_SEEDS, ...generatedSeeds(40)]
  const records: Record<string, NftRecord> = {}
  all.forEach((seed, index) => {
    const id = `nft_${seed.slug}`
    const editions = editionsFor(seed.slug, index, rand)
    records[id] = {
      id,
      name: `${seed.name} #${seed.tokenId}`,
      tokenId: seed.tokenId,
      image: seed.art.image,
      imageAlt: seed.art.alt,
      price: eth(seed.price),
      previousPrice: seed.previousPrice ? eth(seed.previousPrice) : null,
      network: seed.network,
      category: seed.category,
      collection: seed.collection,
      rare: seed.rare ?? false,
      // Figma cards are the newest listings, so they lead "Listados recentemente".
      listedAt: new Date(NEWEST_LISTING - index * DAY).toISOString(),
      trending: Math.round(rand() * 1000),
      version: 1,
      description: `${seed.name} #${seed.tokenId} é uma obra digital finalizada à mão da coleção ${seed.collection.name}. Cada atributo fica armazenado nos metadados do token e é verificado na rede.`,
      attributes: [
        pick3(rand, ['Óculos', 'Esmeralda', 'Raro', 'Chapéu', 'Fones', 'Neon', 'Dourado', 'Pixel']),
      ].flat(),
      editions,
      contractAddress: `0x7A42${seed.tokenId}0000000000000000000000000000019E8`.slice(0, 42),
      royaltiesBps: 500,
      creator: seed.collection.name === 'Kurio Apes' ? 'Nova Sato' : 'Estúdio Kurio',
      rating: { average: 4 + Math.round(rand() * 10) / 10, count: 3 + Math.floor(rand() * 30) },
      maxPerOrder: 10,
    }
  })
  return records
}

function pick3(rand: () => number, list: string[]): string[] {
  const start = Math.floor(rand() * list.length)
  return [0, 1, 2].map((k) => list[(start + k) % list.length] as string)
}
