import type { z } from 'zod'
import { fail, type Result, succeed } from './result'

/** Parses input with a contract schema; failures become VALIDATION with field → message-key pairs. */
export function validate<S extends z.ZodType>(schema: S, input: unknown): Result<z.infer<S>> {
  const parsed = schema.safeParse(input)
  if (parsed.success) return succeed(parsed.data)
  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.') || '_'
    fieldErrors[path] ??= issue.message
  }
  return fail('VALIDATION', 'Invalid input', fieldErrors)
}
