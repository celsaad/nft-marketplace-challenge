// Private flows (checkout, Orders, profile, Wallets) require a Session (spec §Conta e sessão).
// Entering without one, or losing it mid-flow, goes to login with the way back preserved.
import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getSession, useSessionStore } from '@/app/session/store'

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ location }) => {
    if (!getSession().token) {
      throw redirect({ to: '/entrar', search: { redirect: location.href, reason: 'required' } })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const status = useSessionStore((s) => s.status)
  const href = useRouterState({ select: (s) => s.location.href })
  const navigate = useNavigate()

  useEffect(() => {
    if (status !== 'authenticated') {
      void navigate({
        to: '/entrar',
        search: { redirect: href, reason: status === 'expired' ? 'expired' : 'required' },
        replace: true,
      })
    }
  }, [status, href, navigate])

  return status === 'authenticated' ? <Outlet /> : null
}
