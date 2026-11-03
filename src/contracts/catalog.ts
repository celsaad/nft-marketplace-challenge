import { z } from 'zod'
import { EthSchema, IdSchema, IsoDateSchema, NetworkSchema } from './common'

export const CATEGORIES = [
  'digital-art',
  'photography',
  'music',
  '3d-art',
  'collectibles',
  'generative',
  'games',
  'subscriptions',
  'utility',
] as const
export const CategorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof CategorySchema>

export const CATALOG_TABS = ['all', 'new', 'trending'] as const
export const CATALOG_SORTS = ['recent', 'price-asc', 'price-desc', 'name'] as const
export const CATALOG_PAGE_SIZE = 9

/** Catalog search params; the same schema validates the URL and the API query string. */
export const CatalogQuerySchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.array(CategorySchema).optional().catch(undefined),
  network: z.array(NetworkSchema).optional().catch(undefined),
  minPrice: EthSchema.optional().catch(undefined),
  maxPrice: EthSchema.optional().catch(undefined),
  tab: z.enum(CATALOG_TABS).optional().catch(undefined),
  sort: z.enum(CATALOG_SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>

export const EditionSchema = z.object({
  id: IdSchema,
  /** null = Open Edition (ABERTA). */
  size: z.number().int().positive().nullable(),
  available: z.number().int().min(0),
})
export type Edition = z.infer<typeof EditionSchema>

export const NftSummarySchema = z.object({
  id: IdSchema,
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  price: EthSchema,
  previousPrice: EthSchema.nullable(),
  network: NetworkSchema,
  category: CategorySchema,
  collection: z.object({ id: IdSchema, name: z.string() }),
  rare: z.boolean(),
  listedAt: IsoDateSchema,
  soldOut: z.boolean(),
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof NftSummarySchema>

export const NftDetailSchema = NftSummarySchema.extend({
  description: z.string(),
  attributes: z.array(z.string()),
  editions: z.array(EditionSchema).min(1),
  contractAddress: z.string(),
  royaltiesBps: z.number().int(),
  creator: z.string(),
  rating: z.object({ average: z.number(), count: z.number().int() }),
  /** Maximum quantity per Cart Line for any Edition of this NFT. */
  maxPerOrder: z.number().int().positive(),
})
export type NftDetail = z.infer<typeof NftDetailSchema>

export const CatalogPageSchema = z.object({
  items: z.array(NftSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    categories: z.record(CategorySchema, z.number().int()),
    networks: z.record(NetworkSchema, z.number().int()),
    priceRange: z.object({ min: EthSchema, max: EthSchema }),
  }),
})
export type CatalogPage = z.infer<typeof CatalogPageSchema>

export const ReviewSchema = z.object({
  id: IdSchema,
  author: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string(),
  createdAt: IsoDateSchema,
})
export type Review = z.infer<typeof ReviewSchema>
