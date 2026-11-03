// Every failure the API client can surface, as one discriminated type (module-design §5).
import { isAxiosError } from 'axios'
import { ApiErrorBodySchema, type ErrorCode } from '@/contracts/common'

export type ApiErrorKind =
  | 'validation'
  | 'invalidCredentials'
  | 'unauthenticated'
  | 'sessionExpired'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'quoteStale'
  | 'idempotencyConflict'
  | 'transient'
  | 'network'
  | 'timeout'

const KIND_BY_CODE: Partial<Record<ErrorCode, ApiErrorKind>> = {
  VALIDATION: 'validation',
  INVALID_CREDENTIALS: 'invalidCredentials',
  UNAUTHENTICATED: 'unauthenticated',
  SESSION_EXPIRED: 'sessionExpired',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'notFound',
  QUOTE_STALE: 'quoteStale',
  IDEMPOTENCY_CONFLICT: 'idempotencyConflict',
  TRANSIENT: 'transient',
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  /** The API's error code, when the server answered. */
  readonly code: ErrorCode | null
  readonly status: number | null
  /** Field path → i18n message key. */
  readonly fieldErrors: Record<string, string>

  constructor(
    kind: ApiErrorKind,
    message: string,
    extra: { code?: ErrorCode | null; status?: number | null; fieldErrors?: Record<string, string> } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.code = extra.code ?? null
    this.status = extra.status ?? null
    this.fieldErrors = extra.fieldErrors ?? {}
  }

  /** Worth retrying automatically: nothing was decided server-side. */
  get retryable(): boolean {
    return this.kind === 'transient' || this.kind === 'network' || this.kind === 'timeout'
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error
  if (!isAxiosError(error)) return new ApiError('network', String(error))
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ApiError('timeout', 'The request timed out')
  }
  if (!error.response) return new ApiError('network', error.message)

  const { status, data } = error.response
  const body = ApiErrorBodySchema.safeParse(data)
  if (!body.success) {
    return new ApiError(status >= 500 ? 'transient' : 'conflict', `HTTP ${status}`, { status })
  }
  const { code, message, fieldErrors } = body.data.error
  const kind = KIND_BY_CODE[code] ?? (status >= 500 ? 'transient' : 'conflict')
  return new ApiError(kind, message, { code, status, fieldErrors })
}
