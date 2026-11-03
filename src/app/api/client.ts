// The single Axios instance every REST call goes through (no fake responses here: ADR 0001).
import { create as createAxios } from 'axios'
import { HEADERS } from '@/contracts/common'
import { backendReady } from '../backend-ready'
import { config } from '../config'
import { getSession } from '../session/store'
import { ApiError, toApiError } from './errors'

export const REQUEST_TIMEOUT_MS = 10_000

export const http = createAxios({
  baseURL: config.apiBase,
  headers: { 'Content-Type': 'application/json' },
  // Repeated keys for arrays (?category=a&category=b), matching the catalog contract.
  paramsSerializer: { indexes: null },
})

let onSessionInvalid: (() => void) | null = null

/** Registered by the session lifecycle; called when the API says the Session is gone. */
export function setSessionInvalidHandler(handler: () => void) {
  onSessionInvalid = handler
}

/**
 * The request timeout runs on a JS timer that aborts the request, not on XHR's own timeout: the
 * mock layer hands XHR timeouts to the browser, where a test's controlled clock can't reach them.
 * Keyed by each request's signal; the caller's own signal (TanStack Query's cancel) still aborts it.
 */
const deadlines = new WeakMap<AbortSignal, { timer: ReturnType<typeof setTimeout>; expired: boolean }>()

function withDeadline(outer: AbortSignal | undefined): AbortSignal {
  const controller = new AbortController()
  if (outer?.aborted) controller.abort()
  else outer?.addEventListener('abort', () => controller.abort(), { once: true })
  const deadline = {
    expired: false,
    timer: setTimeout(() => {
      deadline.expired = true
      controller.abort()
    }, REQUEST_TIMEOUT_MS),
  }
  deadlines.set(controller.signal, deadline)
  return controller.signal
}

/** Clears the request's timer; true when the request failed because it ran out of time. */
function settle(signal: unknown): boolean {
  const deadline = signal instanceof AbortSignal ? deadlines.get(signal) : undefined
  if (deadline) clearTimeout(deadline.timer)
  return deadline?.expired ?? false
}

http.interceptors.request.use((request) =>
  backendReady.then(() => {
    const { token, guestCartId } = getSession()
    if (token) request.headers.set(HEADERS.authorization, `Bearer ${token}`)
    else if (guestCartId) request.headers.set(HEADERS.cartId, guestCartId)
    request.signal = withDeadline(request.signal as AbortSignal | undefined)
    return request
  }),
)

http.interceptors.response.use(
  (response) => {
    settle(response.config.signal)
    return response
  },
  (raw) => {
    const timedOut = settle(raw?.config?.signal)
    const error = timedOut ? new ApiError('timeout', 'The request timed out') : toApiError(raw)
    const sentToken = Boolean(raw?.config?.headers?.get?.(HEADERS.authorization))
    if (sentToken && (error.kind === 'sessionExpired' || error.kind === 'unauthenticated'))
      onSessionInvalid?.()
    return Promise.reject(error)
  },
)
