import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PagePlaceholder } from '@/ui/page-placeholder'
import { SafeRedirectSchema } from './entrar'

export const Route = createFileRoute('/cadastro')({
  validateSearch: z.object({ redirect: SafeRedirectSchema }),
  component: () => <PagePlaceholder title="Cadastro" />,
})
