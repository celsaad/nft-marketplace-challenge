import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PagePlaceholder } from '@/ui/page-placeholder'

/** Only same-site paths are accepted as a return target (no open redirects). */
export const SafeRedirectSchema = z
  .string()
  .regex(/^\/(?!\/)/)
  .optional()
  .catch(undefined)

export const LoginSearchSchema = z.object({
  redirect: SafeRedirectSchema,
  reason: z.enum(['expired', 'required']).optional().catch(undefined),
})

export const Route = createFileRoute('/entrar')({
  validateSearch: LoginSearchSchema,
  component: () => <PagePlaceholder title="Login" />,
})
