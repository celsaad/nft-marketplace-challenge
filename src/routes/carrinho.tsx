import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/ui/page-placeholder'

export const Route = createFileRoute('/carrinho')({
  component: () => <PagePlaceholder title="Carrinho de NFTs" />,
})
