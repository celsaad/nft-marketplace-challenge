import { ERROR_STATUS, type ErrorCode } from '@/contracts/common'

export interface DomainError {
  code: ErrorCode
  status: number
  message: string
  fieldErrors?: Record<string, string>
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError }

export const succeed = <T>(value: T): Result<T> => ({ ok: true, value })

export const fail = (
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): Result<never> => ({
  ok: false,
  error: { code, status: ERROR_STATUS[code], message, ...(fieldErrors ? { fieldErrors } : {}) },
})
