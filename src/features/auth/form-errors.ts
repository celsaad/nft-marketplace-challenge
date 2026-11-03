// Puts the API's field errors (EMAIL_TAKEN, VALIDATION, wrong current password, …) on the field they
// belong to, so they're read with that field exactly like client-side validation errors.
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/app/api/errors'

/** Returns true when at least one error landed on a field of this form. */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!isApiError(error)) return false
  const matching = fields.filter((field) => error.fieldErrors[field])
  matching.forEach((field, index) => {
    setError(field, { type: 'server', message: error.fieldErrors[field] }, { shouldFocus: index === 0 })
  })
  return matching.length > 0
}

/** Session Expiry is handled by the session lifecycle (redirect + announcement); forms stay quiet. */
export const isSessionLoss = (error: unknown) =>
  isApiError(error) && (error.kind === 'sessionExpired' || error.kind === 'unauthenticated')
