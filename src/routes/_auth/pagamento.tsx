import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/ui/page-placeholder'

export const Route = createFileRoute('/_auth/pagamento')({
  component: () => <PagePlaceholder title="Pagamento" />,
})
