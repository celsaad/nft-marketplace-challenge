import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/ui/page-placeholder'

export const Route = createFileRoute('/_auth/carteiras')({
  component: () => <PagePlaceholder title="Carteiras" />,
})
