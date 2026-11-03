// The quantity stepper's behavior (docs/decisions.md §Interaction safety): the number on screen
// changes at once; the server hears about it 400 ms after the last click, with the final value.
import { useCallback, useEffect, useRef, useState } from 'react'
import { type ApiError, toApiError } from '@/app/api/errors'
import type { CartLine } from '@/contracts/purchase'
import { useSetQuantity } from './mutations'

export const QUANTITY_DEBOUNCE_MS = 400

interface Callbacks {
  onSaved?: (quantity: number) => void
  onError?: (error: ApiError) => void
}

export function useLineQuantity(line: CartLine, callbacks: Callbacks = {}) {
  const { mutate, isPending } = useSetQuantity(line.id)
  const [draft, setDraft] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The value waiting for the debounce to end. */
  const queued = useRef<number | null>(null)
  /** The last value handed to the server; only its answer may clear the draft. */
  const latest = useRef<number | null>(null)
  // Read from timers and server answers, so they always see this render's values.
  const live = useRef({ callbacks, serverQuantity: line.quantity })
  useEffect(() => {
    live.current = { callbacks, serverQuantity: line.quantity }
  })

  const commit = useCallback(
    (quantity: number) => {
      timer.current = null
      queued.current = null
      latest.current = quantity
      if (quantity === live.current.serverQuantity) {
        setDraft(null)
        return
      }
      mutate(quantity, {
        onSuccess: () => {
          if (latest.current !== quantity) return
          setDraft(null)
          live.current.callbacks.onSaved?.(quantity)
        },
        onError: (error) => {
          if (latest.current !== quantity) return
          setDraft(null)
          live.current.callbacks.onError?.(toApiError(error))
        },
      })
    },
    [mutate],
  )

  const setQuantity = useCallback(
    (next: number) => {
      const max = Math.max(1, line.maxQuantity)
      const clamped = Math.min(Math.max(1, Math.trunc(next)), max)
      setDraft(clamped)
      queued.current = clamped
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => commit(clamped), QUANTITY_DEBOUNCE_MS)
    },
    [commit, line.maxQuantity],
  )

  // Leaving the page within the debounce window still saves the last value.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (queued.current !== null) commit(queued.current)
    },
    [commit],
  )

  return {
    quantity: draft ?? line.quantity,
    setQuantity,
    /** True while a change is waiting for the debounce or the server. */
    saving: draft !== null || isPending,
  }
}
