import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CatalogQuerySchema } from '@/contracts/catalog'
import { EthSchema } from '@/contracts/common'
import { HomePage } from '@/features/catalog/home-page'

/** A hand-typed `?q=42` or `?minPrice=1.5` arrives as a number; the schemas expect strings. */
const asText = (value: unknown) => (typeof value === 'number' ? String(value) : value)

/** Catalog state lives in the URL (spec §Catálogo); invalid values are dropped, never crash. */
export const HomeSearchSchema = CatalogQuerySchema.extend({
  q: z.preprocess(asText, CatalogQuerySchema.shape.q),
  minPrice: z.preprocess(asText, EthSchema.optional()).catch(undefined),
  maxPrice: z.preprocess(asText, EthSchema.optional()).catch(undefined),
  favorites: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute('/')({
  validateSearch: HomeSearchSchema,
  component: HomePage,
})
