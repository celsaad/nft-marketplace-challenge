import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { getSession } from '@/app/session/store'
import { LoginForm } from '@/features/auth/login-form'

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

/** A Collector who already has a Session has nothing to do here: send them on. */
export const leaveIfAuthenticated = (target: string | undefined) => {
  if (getSession().token) throw redirect({ href: target ?? '/', replace: true })
}

export const Route = createFileRoute('/entrar')({
  validateSearch: LoginSearchSchema,
  beforeLoad: ({ search }) => leaveIfAuthenticated(search.redirect),
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target, reason } = Route.useSearch()
  return <LoginForm redirect={target} reason={reason} />
}
