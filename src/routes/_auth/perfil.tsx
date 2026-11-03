import { createFileRoute } from '@tanstack/react-router'
import { PagePlaceholder } from '@/ui/page-placeholder'

export const Route = createFileRoute('/_auth/perfil')({
  component: () => <PagePlaceholder title="Perfil do colecionador" />,
})
