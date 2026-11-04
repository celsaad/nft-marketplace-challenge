// Accessible form field: the label, description and error are wired to the control with ids, so
// screen readers announce the error with the field (spec §Interface, accessibility).
import { cloneElement, type ReactElement, useId } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '../lib/utils'
import { Label } from '../primitives/label'

interface ControlProps {
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}

export function FormField({
  label,
  error,
  description,
  required,
  className,
  children,
}: {
  label: string
  /** An i18n message key (from Zod or the API) or plain text. */
  error?: string
  description?: string
  required?: boolean
  className?: string
  children: ReactElement<ControlProps>
}) {
  const t = useT()
  const id = useId()
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`
  const describedBy = [description && descriptionId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="font-normal md:text-[15px]">
        {label}
        {required && (
          <span aria-hidden className="text-destructive">
            *
          </span>
        )}
      </Label>
      {cloneElement(children, {
        id,
        'aria-invalid': Boolean(error) || undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {description && (
        <p id={descriptionId} className="text-xs text-subtle-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  )
}
