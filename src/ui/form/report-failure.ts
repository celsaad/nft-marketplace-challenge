// Applies describeFailure to a form: field errors land on their fields (the first one focused) and
// read like client-side validation; anything else becomes one message, a toast unless the form
// shows it inline. A lost Session stays silent: the session lifecycle already handles it.
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { type MessageKey, t } from '@/lib/i18n'
import { describeFailure } from '../failure'

export function reportFailure<T extends FieldValues = FieldValues>(
  error: unknown,
  {
    setError,
    fields = [],
    onMessage = (key) => toast.error(t(key)),
  }: {
    setError?: UseFormSetError<T>
    fields?: readonly Path<T>[]
    onMessage?: (key: MessageKey) => void
  } = {},
): void {
  const failure = describeFailure(error, setError ? fields : [])
  if (failure.kind === 'silent') return
  if (failure.kind === 'message') return onMessage(failure.key)
  failure.errors.forEach(([field, message], index) => {
    setError?.(field, { type: 'server', message }, { shouldFocus: index === 0 })
  })
}
