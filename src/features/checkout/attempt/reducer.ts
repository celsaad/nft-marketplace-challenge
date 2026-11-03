// The Checkout Attempt state machine (module-design §9). Pure: the hook feeds it API results and
// realtime Quotes, and persists what it needs to survive a refresh.
import type { ApiErrorKind } from '@/app/api/errors'
import type { OrderStatus } from '@/contracts/purchase'

export type AttemptStatus =
  | 'reviewing'
  | 'quoteChanged'
  | 'submitting'
  | 'pending'
  | 'recovering'
  | 'confirmed'
  | 'rejected'
  | 'failed'

/** The part of a Quote the state machine looks at. */
export interface AttemptQuote {
  hash: string
  paymentNetwork: string
  /** What changed since the Cart the Collector last saw. */
  issues: readonly unknown[]
}

export interface Attempt<Q extends AttemptQuote> {
  status: AttemptStatus
  /** The Idempotency Key: one per attempt, reused by every retry. */
  key: string
  /** The Quote the Collector is reviewing, or the one that was submitted. */
  quote: Q | null
  /** In `quoteChanged`: the fresh Quote waiting for the Collector to accept it. */
  nextQuote: Q | null
  orderId: string | null
  error: ApiErrorKind | null
}

export type AttemptAction<Q extends AttemptQuote> =
  | { type: 'quoteReceived'; quote: Q }
  | { type: 'submit' }
  | { type: 'submitSucceeded'; order: { id: string; status: OrderStatus } }
  | { type: 'submitFailed'; error: ApiErrorKind }
  | { type: 'retry' }
  | { type: 'acceptNewQuote' }
  | { type: 'orderUpdated'; status: OrderStatus }
  /** A new attempt (new Idempotency Key) after a rejected Order or a failure the server decided. */
  | { type: 'startOver'; key: string }

/** Nothing was decided server-side, or we can't know: resending the same key is safe. */
const UNKNOWN_OUTCOME: ReadonlySet<ApiErrorKind> = new Set(['timeout', 'network', 'transient'])

export function startAttempt<Q extends AttemptQuote>(key: string): Attempt<Q> {
  return { status: 'reviewing', key, quote: null, nextQuote: null, orderId: null, error: null }
}

/** Rebuilds an attempt saved before a refresh: an Order already created is followed, never re-created. */
export function resumeAttempt<Q extends AttemptQuote>(saved: {
  key: string
  orderId: string | null
  /** The Order request was sent; without an Order id its outcome is unknown. */
  submitted: boolean
}): Attempt<Q> {
  const attempt = startAttempt<Q>(saved.key)
  if (saved.orderId) return { ...attempt, status: 'pending', orderId: saved.orderId }
  if (saved.submitted) return { ...attempt, status: 'recovering' }
  return attempt
}

export function attemptReducer<Q extends AttemptQuote>(
  state: Attempt<Q>,
  action: AttemptAction<Q>,
): Attempt<Q> {
  switch (action.type) {
    case 'quoteReceived':
      return receiveQuote(state, action.quote)
    case 'submit':
      return state.status === 'reviewing' ? { ...state, status: 'submitting' } : state
    case 'submitSucceeded':
      if (state.status !== 'submitting') return state
      return { ...state, status: action.order.status, orderId: action.order.id, error: null }
    case 'submitFailed':
      if (state.status !== 'submitting') return state
      if (action.error === 'quoteStale') return { ...state, status: 'quoteChanged', nextQuote: null }
      if (UNKNOWN_OUTCOME.has(action.error)) return { ...state, status: 'recovering', error: action.error }
      return { ...state, status: 'failed', error: action.error }
    case 'retry':
      return state.status === 'recovering' ? { ...state, status: 'submitting' } : state
    case 'acceptNewQuote':
      if (state.status !== 'quoteChanged' || !state.nextQuote) return state
      return { ...state, status: 'reviewing', quote: state.nextQuote, nextQuote: null, error: null }
    case 'orderUpdated':
      if (state.status !== 'pending' || action.status === 'pending') return state
      return { ...state, status: action.status }
    case 'startOver':
      if (state.status !== 'rejected' && state.status !== 'failed') return state
      return { ...startAttempt<Q>(action.key), quote: state.quote }
  }
}

/**
 * A new Quote only replaces the reviewed one silently when nothing the Collector agreed to has
 * changed (same hash, i.e. just a refresh) or they changed the Payment Network themselves.
 */
function receiveQuote<Q extends AttemptQuote>(state: Attempt<Q>, quote: Q): Attempt<Q> {
  if (state.status === 'quoteChanged') {
    // The server reports each change once; a refetch must not hide what the Collector hasn't seen.
    const issues = quote.issues.length > 0 ? quote.issues : (state.nextQuote?.issues ?? [])
    return { ...state, nextQuote: { ...quote, issues } }
  }
  if (state.status !== 'reviewing') return state
  const current = state.quote
  const changed =
    quote.issues.length > 0 ||
    (current !== null && current.paymentNetwork === quote.paymentNetwork && current.hash !== quote.hash)
  return changed ? { ...state, status: 'quoteChanged', nextQuote: quote } : { ...state, quote }
}
