// The Session lifecycle (module-design §7): the single place that knows what a Session change
// means. Callers never purge caches or rebind realtime themselves.
import type { LoginInput, Session, SignupInput } from '@/contracts/account'
import { announce } from '../announcer'
import { setSessionInvalidHandler } from '../api/client'
import { api } from '../api/endpoints'
import { queryClient } from '../query/client'
import { keys } from '../query/keys'
import { connectRealtime } from '../realtime/client'
import { getSession, useSessionStore } from './store'

/** Clears everything that belonged to the previous Session (ADR 0002 isolation). */
function purgePrivateData() {
  queryClient.removeQueries({ queryKey: keys.private })
  queryClient.removeQueries({ queryKey: keys.guest })
}

function begin(session: Session) {
  const previous = getSession().collectorId ?? getSession().lastCollectorId
  // The Guest Cart has been merged server-side; a different Collector must not see the last one's data.
  queryClient.removeQueries({ queryKey: keys.guest })
  if (previous && previous !== session.collector.id) queryClient.removeQueries({ queryKey: keys.private })

  useSessionStore.setState({
    status: 'authenticated',
    token: session.token,
    expiresAt: session.expiresAt,
    collectorId: session.collector.id,
    lastCollectorId: session.collector.id,
    guestCartId: null,
  })
  queryClient.setQueryData(keys.me(session.collector.id), session.collector)
  void connectRealtime()
}

export async function login(input: LoginInput) {
  begin(await api.auth.login(input))
}

export async function signup(input: SignupInput) {
  begin(await api.auth.signup(input))
}

export async function logout() {
  try {
    await api.auth.logout()
  } catch {
    // Logging out locally is what matters; the server Session expires on its own.
  } finally {
    useSessionStore.setState({ status: 'guest', token: null, expiresAt: null, collectorId: null })
    purgePrivateData()
    void connectRealtime()
  }
}

/** The API said the Session is gone: keep who it was (to restore their draft), drop everything private. */
export function expire() {
  if (!getSession().token) return
  useSessionStore.setState((s) => ({
    status: 'expired',
    token: null,
    expiresAt: null,
    collectorId: null,
    lastCollectorId: s.collectorId,
  }))
  purgePrivateData()
  announce({ kind: 'session-expired' })
  void connectRealtime()
}

/** Called once at boot, after the mocks (if any) are running. */
export function bootSession() {
  setSessionInvalidHandler(expire)
  const { token, expiresAt } = getSession()
  if (token && expiresAt && Date.parse(expiresAt) <= Date.now()) expire()
  else if (token) void api.auth.session().catch(() => undefined) // a dead token triggers expire()
  void connectRealtime()
}
