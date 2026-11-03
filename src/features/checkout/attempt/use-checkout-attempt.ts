// useCheckoutAttempt (module-design §9): drives the pure reducer with real API calls, keeps the
// Idempotency Key and the sent request in sessionStorage, and resumes after a refresh. The
// QueryClient never retries Order creation; recovery happens here, always with the same key.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { api } from '@/app/api/endpoints'
import { type ApiError, toApiError } from '@/app/api/errors'
import { keys } from '@/app/query/keys'
import type { BuyerDetails, CreateOrderInput, Order, Quote } from '@/contracts/purchase'
import { orderQuery } from '@/features/orders/queries'
import { type Attempt, attemptReducer, resumeAttempt, startAttempt } from './reducer'
import { readAttempt, saveAttempt } from './storage'

export type { AttemptStatus } from './reducer'

const newKey = () => crypto.randomUUID()

function initialAttempt(collectorId: string): { attempt: Attempt<Quote>; input: CreateOrderInput | null } {
  const saved = readAttempt(collectorId)
  // An attempt that already has an Order is followed on the Order page, never resumed here.
  if (!saved || saved.orderId) return { attempt: startAttempt<Quote>(newKey()), input: null }
  return {
    attempt: resumeAttempt<Quote>({ key: saved.key, orderId: null, submitted: saved.input !== null }),
    input: saved.input,
  }
}

export interface CheckoutAttempt {
  state: Attempt<Quote>['status']
  /** The Quote being reviewed (or submitted). */
  quote: Quote | null
  /** A fresh Quote the Collector has to accept before confirming again. */
  nextQuote: Quote | null
  order: Order | undefined
  orderId: string | null
  error: ApiError | null
  confirm: (buyer: BuyerDetails) => void
  acceptNewQuote: () => void
  retry: () => void
  startOver: () => void
}

export function useCheckoutAttempt({
  collectorId,
  quote,
  walletId,
}: {
  collectorId: string
  /** The latest Quote from the server for the chosen Payment Network. */
  quote: Quote | undefined
  walletId: string | null
}): CheckoutAttempt {
  const queryClient = useQueryClient()
  const [initial] = useState(() => initialAttempt(collectorId))
  const [state, dispatch] = useReducer(attemptReducer<Quote>, initial.attempt)
  const [error, setError] = useState<ApiError | null>(null)
  /** The request in flight or awaiting recovery: a retry resends exactly this. */
  const sent = useRef<CreateOrderInput | null>(initial.input)
  /** Locks on the first click, before React has re-rendered with `submitting`. */
  const busy = useRef(false)

  // Every new server Quote goes through the reducer, which decides whether it needs consent.
  const [fedQuote, setFedQuote] = useState<Quote | undefined>(undefined)
  if (quote && quote !== fedQuote) {
    setFedQuote(quote)
    dispatch({ type: 'quoteReceived', quote })
  }

  const order = useQuery({ ...orderQuery(collectorId, state.orderId ?? ''), enabled: Boolean(state.orderId) })
  const [seenStatus, setSeenStatus] = useState(order.data?.status)
  if (order.data && order.data.status !== seenStatus) {
    setSeenStatus(order.data.status)
    dispatch({ type: 'orderUpdated', status: order.data.status })
  }

  useEffect(() => {
    saveAttempt({
      collectorId,
      key: state.key,
      quoteHash: sent.current?.quoteHash ?? state.quote?.hash ?? null,
      orderId: state.orderId,
      input: state.orderId ? null : sent.current,
    })
  }, [collectorId, state])

  const send = useCallback(
    async (input: CreateOrderInput, key: string) => {
      try {
        const created = await api.orders.create(input, key)
        sent.current = null
        queryClient.setQueryData(keys.order(collectorId, created.id), created)
        setError(null)
        dispatch({ type: 'submitSucceeded', order: created })
      } catch (raw) {
        const failure = toApiError(raw)
        // Only an unknown outcome keeps the request for a same-key retry; anything the server
        // decided (stale Quote, wallet, validation) means no Order exists for this key.
        if (!failure.retryable) sent.current = null
        if (failure.kind === 'quoteStale') {
          void queryClient.invalidateQueries({ queryKey: keys.quoteAll(collectorId) })
          void queryClient.invalidateQueries({ queryKey: keys.cart(collectorId) })
        }
        setError(failure)
        dispatch({ type: 'submitFailed', error: failure.kind })
      } finally {
        busy.current = false
      }
    },
    [collectorId, queryClient],
  )

  const confirm = useCallback(
    (buyer: BuyerDetails) => {
      const reviewed = state.quote
      if (busy.current || state.status !== 'reviewing' || !reviewed || !walletId) return
      busy.current = true
      const input: CreateOrderInput = {
        quoteId: reviewed.id,
        quoteHash: reviewed.hash,
        walletId,
        paymentNetwork: reviewed.paymentNetwork,
        buyer,
      }
      sent.current = input
      dispatch({ type: 'submit' })
      void send(input, state.key)
    },
    [send, state, walletId],
  )

  const retry = useCallback(() => {
    const input = sent.current
    if (busy.current || state.status !== 'recovering' || !input) return
    busy.current = true
    dispatch({ type: 'retry' })
    void send(input, state.key)
  }, [send, state])

  // A refresh while the outcome was unknown: ask again, with the same key (never a second Order).
  const resumedRecovering = useRef(initial.attempt.status === 'recovering')
  useEffect(() => {
    if (!resumedRecovering.current) return
    resumedRecovering.current = false
    retry()
  }, [retry])

  const acceptNewQuote = useCallback(() => dispatch({ type: 'acceptNewQuote' }), [])
  const startOver = useCallback(() => {
    sent.current = null
    setError(null)
    dispatch({ type: 'startOver', key: newKey() })
  }, [])

  return {
    state: state.status,
    quote: state.quote,
    nextQuote: state.nextQuote,
    order: order.data,
    orderId: state.orderId,
    error,
    confirm,
    acceptNewQuote,
    retry,
    startOver,
  }
}
