import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CatalogQuerySchema } from '@/contracts/catalog'
import { PagePlaceholder } from '@/ui/page-placeholder'

/** Catalog state lives in the URL (spec §Catálogo); invalid values are dropped, never crash. */
export const HomeSearchSchema = CatalogQuerySchema.extend({
  favorites: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute('/')({
  validateSearch: HomeSearchSchema,
  component: () => <PagePlaceholder title="Início" />,
})
