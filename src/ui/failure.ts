// What a failed request means for the screen, decided in one place: nothing (the Session is gone,
// and the session lifecycle already redirects and announces it), errors on the form's own fields,
// or one message worded the same way everywhere.
import { type ApiError, isApiError } from '@/app/api/errors'
import type { MessageKey } from '@/lib/i18n'

const MESSAGE_BY_KIND: Partial<Record<ApiError['kind'], MessageKey>> = {
  network: 'error.network',
  timeout: 'error.timeout',
  transient: 'error.transient',
  forbidden: 'error.forbidden',
  notFound: 'error.notFound',
}

/** The message key for any error, so every screen words failures the same way. */
export function errorMessageKey(error: unknown): MessageKey {
  return (isApiError(error) && MESSAGE_BY_KIND[error.kind]) || 'error.unknown'
}

export const isSessionLoss = (error: unknown) =>
  isApiError(error) && (error.kind === 'sessionExpired' || error.kind === 'unauthenticated')

export type Failure<F extends string> =
  | { kind: 'silent' }
  /** Field → message key, in the form's field order (the first one gets focus). */
  | { kind: 'fields'; errors: [F, string][] }
  | { kind: 'message'; key: MessageKey }

export function describeFailure<F extends string>(error: unknown, fields: readonly F[] = []): Failure<F> {
  if (isSessionLoss(error)) return { kind: 'silent' }
  if (isApiError(error)) {
    const errors = fields.flatMap((field): [F, string][] => {
      const message = error.fieldErrors[field]
      return message ? [[field, message]] : []
    })
    if (errors.length > 0) return { kind: 'fields', errors }
  }
  return { kind: 'message', key: errorMessageKey(error) }
}
