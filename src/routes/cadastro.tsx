import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SignupForm } from '@/features/auth/signup-form'
import { leaveIfAuthenticated, SafeRedirectSchema } from './entrar'

export const Route = createFileRoute('/cadastro')({
  validateSearch: z.object({ redirect: SafeRedirectSchema }),
  beforeLoad: ({ search }) => leaveIfAuthenticated(search.redirect),
  component: SignupPage,
})

function SignupPage() {
  const { redirect } = Route.useSearch()
  return <SignupForm redirect={redirect} />
}
