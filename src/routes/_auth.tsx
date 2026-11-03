// Private flows (checkout, Orders, profile, Wallets) require a Session (spec §Conta e sessão).
// Entering without one, or losing it mid-flow, goes to login with the way back preserved.
import { createFileRoute, Outlet, redirect, useNavigate, useRouter } from '@tanstack/react-router'
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
  const router = useRouter()
  const navigate = useNavigate()

  // Runs on a status change only: depending on the URL would re-fire for the /entrar URL this
  // effect itself navigates to (the layout is still mounted mid-transition) and loop forever.
  useEffect(() => {
    if (status !== 'authenticated') {
      const { href } = router.state.location
      if (href.startsWith('/entrar')) return
      void navigate({
        to: '/entrar',
        search: { redirect: href, reason: status === 'expired' ? 'expired' : 'required' },
        replace: true,
      })
    }
  }, [status, router, navigate])

  return status === 'authenticated' ? <Outlet /> : null
}
