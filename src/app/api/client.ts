// The single Axios instance every REST call goes through (no fake responses here: ADR 0001).
import { create as createAxios } from 'axios'
import { HEADERS } from '@/contracts/common'
import { config } from '../config'
import { getSession } from '../session/store'
import { toApiError } from './errors'

export const REQUEST_TIMEOUT_MS = 10_000

export const http = createAxios({
  baseURL: config.apiBase,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  // Repeated keys for arrays (?category=a&category=b), matching the catalog contract.
  paramsSerializer: { indexes: null },
})

let onSessionInvalid: (() => void) | null = null

/** Registered by the session lifecycle; called when the API says the Session is gone. */
export function setSessionInvalidHandler(handler: () => void) {
  onSessionInvalid = handler
}

http.interceptors.request.use((request) => {
  const { token, guestCartId } = getSession()
  if (token) request.headers.set(HEADERS.authorization, `Bearer ${token}`)
  else if (guestCartId) request.headers.set(HEADERS.cartId, guestCartId)
  return request
})

http.interceptors.response.use(undefined, (raw) => {
  const error = toApiError(raw)
  const sentToken = Boolean(raw?.config?.headers?.get?.(HEADERS.authorization))
  if (sentToken && (error.kind === 'sessionExpired' || error.kind === 'unauthenticated')) onSessionInvalid?.()
  return Promise.reject(error)
})
