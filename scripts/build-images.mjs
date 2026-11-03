// Builds the NFT artwork served from /nfts (ADR 0007) as AVIF + WebP at 320/640/960 px.
// The output in public/nfts is committed, so a clean checkout never needs the network; run this
// only to regenerate it: `FIGMA_TOKEN=… node scripts/build-images.mjs`.
//
// Sources:
// - public/nfts/figma/*: the 4 artworks drawn in the Kurio Figma file (file key below), downloaded
//   through the Figma REST API (`GET /v1/files/:key/images` maps each image fill to a URL). The
//   token comes from the environment and is never logged.
// - public/nfts/cc0/noun-01..24: Nouns 1–24 (https://nouns.wtf). Nouns artwork is public domain
//   under CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/), as stated by Nouns DAO.
//   Fetched as SVG from https://noun.pics/<id>.svg, which renders each Noun's on-chain artwork.
//   noun-NN is Noun #NN; the catalog shows it under a fictional name.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'nfts')
const WIDTHS = [320, 640, 960]
const FIGMA_FILE = 'Ff0SksUi7UFtPWUO8kyNtw'
/** Figma image fill → our image id. The file has 4 artworks (the other fills are UI screenshots). */
const FIGMA_ART = {
  '8459204731e6eba9d474cbc8ebc37071360d3ba5': 'emerald-ape',
  '2986a7cb16d09de8970824d2dd58bf0bb021702c': 'sage-gorilla',
  '9df2ff42dd27ba657621c304557d1a855a4be6a5': 'ivory-ape',
  '87580f2def9af0ce13f4b6f6ce17bb2449bcfc16': 'golden-monkey',
}
const NOUN_COUNT = 24
const nounUrl = (id) => `https://noun.pics/${id}.svg`

async function download(url, headers = {}) {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`GET ${new URL(url).origin}… → ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** Writes <id>-<w>.avif/.webp for every width. Pixel art keeps hard edges (nearest neighbour). */
async function emit(input, id, { pixelArt = false } = {}) {
  const base = join(ROOT, id)
  await mkdir(dirname(base), { recursive: true })
  for (const width of WIDTHS) {
    const resized = sharp(input).resize(width, width, {
      fit: 'cover',
      kernel: pixelArt ? sharp.kernel.nearest : sharp.kernel.lanczos3,
    })
    await writeFile(
      `${base}-${width}.avif`,
      await resized.clone().avif({ quality: 55, effort: 6 }).toBuffer(),
    )
    await writeFile(
      `${base}-${width}.webp`,
      await resized.clone().webp({ quality: 80, effort: 6 }).toBuffer(),
    )
  }
  console.log(`✓ ${id}`)
}

async function buildFigma() {
  const token = process.env.FIGMA_TOKEN
  if (!token) throw new Error('Set FIGMA_TOKEN to download the Figma artwork')
  const fills = JSON.parse(
    (
      await download(`https://api.figma.com/v1/files/${FIGMA_FILE}/images`, { 'X-Figma-Token': token })
    ).toString(),
  ).meta.images
  for (const [ref, name] of Object.entries(FIGMA_ART)) {
    if (!fills[ref]) throw new Error(`Figma image fill ${ref} (${name}) not found`)
    await emit(await download(fills[ref]), `figma/${name}`)
  }
}

async function buildNouns() {
  for (let id = 1; id <= NOUN_COUNT; id++) {
    // Rasterize the 320 px SVG 1:1, then scale by whole multiples so every pixel stays square.
    const png = await sharp(await download(nounUrl(id)))
      .png()
      .toBuffer()
    await emit(png, `cc0/noun-${String(id).padStart(2, '0')}`, { pixelArt: true })
  }
}

const only = process.argv[2]
if (!only || only === 'figma') await buildFigma()
if (!only || only === 'cc0') await buildNouns()
