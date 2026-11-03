import { describe, expect, it } from 'vitest'
import { type Attempt, type AttemptAction, attemptReducer, resumeAttempt, startAttempt } from './reducer'

interface TestQuote {
  id: string
  hash: string
  paymentNetwork: string
  issues: readonly unknown[]
}

const quote = (hash: string, extra: Partial<TestQuote> = {}): TestQuote => ({
  id: `q-${hash}`,
  hash,
  paymentNetwork: 'ethereum',
  issues: [],
  ...extra,
})

const run = (state: Attempt<TestQuote>, ...actions: AttemptAction<TestQuote>[]) =>
  actions.reduce(attemptReducer<TestQuote>, state)

const reviewing = () => run(startAttempt<TestQuote>('key-1'), { type: 'quoteReceived', quote: quote('h1') })

describe('Checkout Attempt', () => {
  it('ignores a second submit while the first is still submitting', () => {
    const first = run(reviewing(), { type: 'submit' })
    const second = run(first, { type: 'submit' })

    expect(first.status).toBe('submitting')
    expect(second).toBe(first)
  })

  it.each(['timeout', 'network', 'transient'] as const)(
    'recovers from a %s by retrying with the same Idempotency Key',
    (error) => {
      const lost = run(reviewing(), { type: 'submit' }, { type: 'submitFailed', error })
      expect(lost.status).toBe('recovering')
      expect(lost.error).toBe(error)

      const retried = run(lost, { type: 'retry' })
      expect(retried.status).toBe('submitting')
      expect(retried.key).toBe('key-1')

      const recovered = run(retried, { type: 'submitSucceeded', order: { id: 'ord_1', status: 'pending' } })
      expect(recovered).toMatchObject({ status: 'pending', key: 'key-1', orderId: 'ord_1', error: null })
    },
  )

  it('asks for a new confirmation when the server answers QUOTE_STALE', () => {
    const stale = run(reviewing(), { type: 'submit' }, { type: 'submitFailed', error: 'quoteStale' })
    expect(stale).toMatchObject({ status: 'quoteChanged', nextQuote: null })
    // Nothing to accept until the fresh Quote has arrived.
    expect(run(stale, { type: 'acceptNewQuote' })).toBe(stale)

    const fresh = quote('h2', { issues: [{ kind: 'sold-out', lineId: 'l1' }] })
    const informed = run(stale, { type: 'quoteReceived', quote: fresh })
    expect(informed).toMatchObject({ status: 'quoteChanged', nextQuote: fresh })
    expect(run(informed, { type: 'submit' })).toBe(informed)

    const accepted = run(informed, { type: 'acceptNewQuote' })
    expect(accepted).toMatchObject({ status: 'reviewing', quote: fresh, nextQuote: null, key: 'key-1' })
    // Accepting is not confirming: the Collector has to confirm again.
    expect(run(accepted, { type: 'submit' }).status).toBe('submitting')
  })

  it('blocks confirmation when a realtime change produces a different Quote while reviewing', () => {
    const changed = run(reviewing(), { type: 'quoteReceived', quote: quote('h2') })
    expect(changed).toMatchObject({ status: 'quoteChanged', quote: quote('h1'), nextQuote: quote('h2') })
    expect(run(changed, { type: 'submit' })).toBe(changed)
  })

  it('asks for confirmation when even the first Quote reports changes', () => {
    const withIssues = quote('h1', { issues: [{ kind: 'price-changed', lineId: 'l1' }] })
    const state = run(startAttempt<TestQuote>('key-1'), { type: 'quoteReceived', quote: withIssues })
    expect(state).toMatchObject({ status: 'quoteChanged', quote: null, nextQuote: withIssues })
  })

  it('takes a refreshed Quote with the same hash, or one for a newly chosen network, without asking', () => {
    const refreshed = run(reviewing(), { type: 'quoteReceived', quote: quote('h1', { id: 'q-later' }) })
    expect(refreshed).toMatchObject({ status: 'reviewing', quote: { id: 'q-later' } })

    const polygon = quote('h-poly', { paymentNetwork: 'polygon' })
    const switched = run(reviewing(), { type: 'quoteReceived', quote: polygon })
    expect(switched).toMatchObject({ status: 'reviewing', quote: polygon })
  })

  it('keeps the submitted Quote while submitting; the server decides whether it is stale', () => {
    const submitting = run(reviewing(), { type: 'submit' })
    expect(run(submitting, { type: 'quoteReceived', quote: quote('h2') })).toBe(submitting)
  })

  it('keeps showing what changed when the fresh Quote is fetched again before it is accepted', () => {
    const issues = [{ kind: 'sold-out', lineId: 'l1' }]
    const changed = run(reviewing(), { type: 'quoteReceived', quote: quote('h2', { issues }) })
    // The server reports a change only once; the refetch carries no issues.
    const refetched = run(changed, { type: 'quoteReceived', quote: quote('h2', { id: 'q-again' }) })
    expect(refetched.nextQuote).toMatchObject({ id: 'q-again', issues })
  })

  it('follows a pending Order to its outcome', () => {
    const pending = run(
      reviewing(),
      { type: 'submit' },
      { type: 'submitSucceeded', order: { id: 'ord_1', status: 'pending' } },
    )
    expect(run(pending, { type: 'orderUpdated', status: 'confirmed' }).status).toBe('confirmed')
    expect(run(pending, { type: 'orderUpdated', status: 'rejected' }).status).toBe('rejected')
  })

  it('starts a new attempt with a new key after a rejection', () => {
    const rejected = run(
      reviewing(),
      { type: 'submit' },
      { type: 'submitSucceeded', order: { id: 'ord_1', status: 'pending' } },
      { type: 'orderUpdated', status: 'rejected' },
    )
    const again = run(rejected, { type: 'startOver', key: 'key-2' })
    expect(again).toMatchObject({
      status: 'reviewing',
      key: 'key-2',
      orderId: null,
      error: null,
      quote: quote('h1'),
    })
  })

  it('starts a new attempt after a failure the server decided (e.g. wallet not connected)', () => {
    const failed = run(reviewing(), { type: 'submit' }, { type: 'submitFailed', error: 'conflict' })
    expect(failed).toMatchObject({ status: 'failed', error: 'conflict' })
    expect(run(failed, { type: 'retry' })).toBe(failed)
    expect(run(failed, { type: 'startOver', key: 'key-2' })).toMatchObject({
      status: 'reviewing',
      key: 'key-2',
    })
  })

  it('never starts over while an Order may still be decided', () => {
    const submitting = run(reviewing(), { type: 'submit' })
    const recovering = run(submitting, { type: 'submitFailed', error: 'timeout' })
    const pending = run(submitting, { type: 'submitSucceeded', order: { id: 'ord_1', status: 'pending' } })
    for (const state of [submitting, recovering, pending]) {
      expect(run(state, { type: 'startOver', key: 'key-2' })).toBe(state)
    }
  })

  describe('terminal states never change', () => {
    const everything: AttemptAction<TestQuote>[] = [
      { type: 'quoteReceived', quote: quote('h9') },
      { type: 'submit' },
      { type: 'submitSucceeded', order: { id: 'ord_9', status: 'pending' } },
      { type: 'submitFailed', error: 'timeout' },
      { type: 'submitFailed', error: 'quoteStale' },
      { type: 'retry' },
      { type: 'acceptNewQuote' },
      { type: 'orderUpdated', status: 'pending' },
      { type: 'orderUpdated', status: 'rejected' },
      { type: 'orderUpdated', status: 'confirmed' },
    ]

    it('a confirmed attempt ignores every event, even startOver', () => {
      const confirmed = run(
        reviewing(),
        { type: 'submit' },
        { type: 'submitSucceeded', order: { id: 'ord_1', status: 'confirmed' } },
      )
      expect(confirmed.status).toBe('confirmed')
      for (const action of [...everything, { type: 'startOver', key: 'key-2' } as const]) {
        expect(run(confirmed, action)).toBe(confirmed)
      }
    })

    it('a rejected attempt ignores every event except an explicit startOver', () => {
      const rejected = run(
        reviewing(),
        { type: 'submit' },
        { type: 'submitSucceeded', order: { id: 'ord_1', status: 'rejected' } },
      )
      expect(rejected.status).toBe('rejected')
      for (const action of everything) expect(run(rejected, action)).toBe(rejected)
    })
  })

  it('ignores a second submit while recovering, so only retry can resend', () => {
    const lost = run(reviewing(), { type: 'submit' }, { type: 'submitFailed', error: 'timeout' })
    expect(run(lost, { type: 'submit' })).toBe(lost)
  })

  describe('after a refresh', () => {
    it('follows the Order it already created', () => {
      expect(resumeAttempt<TestQuote>({ key: 'key-1', orderId: 'ord_1', submitted: true })).toMatchObject({
        status: 'pending',
        key: 'key-1',
        orderId: 'ord_1',
      })
    })

    it('recovers a submission whose answer never arrived, with the same key', () => {
      const resumed = resumeAttempt<TestQuote>({ key: 'key-1', orderId: null, submitted: true })
      expect(resumed).toMatchObject({ status: 'recovering', key: 'key-1' })
      expect(run(resumed, { type: 'retry' })).toMatchObject({ status: 'submitting', key: 'key-1' })
    })

    it('goes back to reviewing when nothing was submitted yet', () => {
      expect(resumeAttempt<TestQuote>({ key: 'key-1', orderId: null, submitted: false })).toMatchObject({
        status: 'reviewing',
        key: 'key-1',
      })
    })
  })
})
